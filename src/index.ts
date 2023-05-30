import equal from "fast-deep-equal";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type UnlockFn = () => boolean;
type LockToken = symbol | string;
type TokenData = {
  isFetching: boolean;
};
type TokenDataContainer = { [key: LockToken]: TokenData };

const nonNullOrUndefined = (i: any) => i !== null && i !== undefined;

const createStore = <GlobalState extends object = {}>(
  initialState: () => GlobalState
) => {
  const UNIQUE_STORE_SYMBOL = Symbol();

  type PartialState = Partial<GlobalState>;
  type PartialStateReturner = (state: GlobalState) => PartialState;

  let state: GlobalState = {
    [UNIQUE_STORE_SYMBOL]: {} as TokenDataContainer,
    ...initialState(),
  };

  const locks = new Map<LockToken, boolean>();
  const getSnapshot = () => state;

  // ===============================

  const listeners = new Set<() => void>();

  const triggerSubscribers = () => {
    listeners.forEach((fn) => fn());
  };

  const update = (
    updater: PartialStateReturner | PartialState,
    forceUpdate = false
  ) => {
    let partialState: PartialState = {};

    switch (typeof updater) {
      case "function":
        partialState = updater(state); // pass realtime-state
        break;
      case "object":
        partialState = updater;
        break;
    }

    // const partialState = fn(state);

    // maybe even do a better merge here, but should be fine for now
    const newState = {
      ...state,
      ...partialState,
    };

    // todo: make a check if it is really still perfing well
    // with huge objects that differ in a deep deep set only
    if (forceUpdate || !equal(state, newState)) {
      state = newState;
      triggerSubscribers();
    }
  };

  const forceUpdate: typeof update = (updater) => {
    update(updater, true);
  };

  /**
   * Returns the token unlocker if free, else returns false
   * @param token
   */
  const getLock: (token: LockToken) => UnlockFn | false = (token) => {
    if (locks.has(token)) {
      return false;
    }

    locks.set(token, true);
    return () => locks.delete(token);
  };

  const subscribe = (onStoreChange: () => void) => {
    listeners.add(onStoreChange);

    return () => {
      listeners.delete(onStoreChange);
    };
  };

  const useStore = <R extends unknown>(
    localReducer: (s: GlobalState) => R
  ): Readonly<[R, () => R]> => {
    const getLiveLocalSnapshot = useCallback(() => {
      return localReducer(getSnapshot());
    }, []);
    // in theory localReducer is a dependency but practically this shouldn't
    // change and is not recommended to change, therefore we keep it forever

    const syncedLocalState = useSyncExternalStore(
      subscribe,
      getSnapshot,
      // do not use the local state here as it will
      // lead to react running to infinite loops
      // due to re-generated function calls which generate new references!
      // always refer to the original state.
      // the only other option would be to do a deep comparison together with useMemo
      // but i dont see the need for that right now
      getSnapshot
    );

    const reduceStateToLocalState = () => {
      return localReducer(syncedLocalState);
    };

    const getRealtimeLocalState = () => getLiveLocalSnapshot();
    return [reduceStateToLocalState(), getRealtimeLocalState] as const;
  };

  const useLockMetadata = (token: LockToken) => {
    const [{ isFetching }] = useStore((s) => {
      const tokenDataContainer = (s as any)?.[
        UNIQUE_STORE_SYMBOL
      ] as TokenDataContainer;

      const tokenData = tokenDataContainer?.[token];

      return {
        isFetching: tokenData?.isFetching,
      };
    });

    const setIsFetching = (isFetching: boolean) => {
      forceUpdate((s) => {
        return {
          ...s,
          [UNIQUE_STORE_SYMBOL]: {
            ...((s as any)?.[UNIQUE_STORE_SYMBOL] as TokenDataContainer),
            [token]: {
              isFetching,
            },
          },
        };
      });
    };

    return { isFetching, setIsFetching } as const;
  };

  /**
   * This function will lock the provided function to be only called once
   * per point of time. It can only be called another time when the previous
   * execution is done (Promise resolved -> finally())
   * @param fetchFunc
   * @return refresh function to call the fetcher again (which is only done when lock is free)
   */
  const useFetchData = <
    T extends unknown,
    R extends unknown,
    FuncParams extends readonly R[],
    ReturnedState extends unknown
  >(
    fetchFunc: (
      set: typeof update,
      ...funcParams: Readonly<FuncParams>
    ) => Promise<T>,
    {
      waitFor,
      token,
      allow,
      data,
    }: {
      waitFor?: FuncParams;
      token?: LockToken;
      allow?: (isInitialCall: boolean) => boolean | "data-empty";
      data?: (s: GlobalState, isFetching?: boolean) => ReturnedState;
    } = {}
  ) => {
    let _token: LockToken = useMemo(() => token ?? Symbol(), [token]);
    const _waitFor: FuncParams | [] = waitFor || [];
    const waitForDeps = useRef<FuncParams | readonly []>(_waitFor);
    const hadInitialCallRef = useRef(false);
    const { isFetching, setIsFetching } = useLockMetadata(_token);
    const [stateData, realtimeStateData] = useStore(
      data ? (s) => data(s, isFetching) : () => undefined
    );

    useEffect(() => {
      waitForDeps.current = _waitFor;
    }, [..._waitFor]);

    const refresh = useCallback(
      (isInitialCall = false) => {
        if (!waitForDeps.current.every(nonNullOrUndefined)) {
          return;
        }

        if (allow) {
          if (typeof allow === "function") {
            if (!allow(isInitialCall)) {
              return; // not allowed to execute
            }
          } else if (allow === "data-empty") {
            const realtimeData = realtimeStateData();

            if (realtimeData !== null && realtimeData !== undefined) {
              return; // not allowed to execute
            }
          }
        }

        const unlocker = getLock(_token as LockToken);

        if (unlocker) {
          setIsFetching(true);

          // then and ONLY then the lock is currently free!
          // console.log("[Debug]: Lock is free, call it ; Token =", token);
          fetchFunc(update, ...(waitForDeps.current as FuncParams)).finally(
            () => {
              unlocker();
              setIsFetching(false);
            }
          ); // when it's done, we unlock
        }
      },
      [fetchFunc, allow]
    );

    const refreshFuncRef = useRef<(isInitialCall: boolean) => void>(refresh);

    useEffect(() => {
      refreshFuncRef.current = refresh;
    }, [refresh]);

    useEffect(() => {
      if (!waitForDeps.current.every(nonNullOrUndefined)) {
        return;
      }

      if (hadInitialCallRef.current) {
        return;
      }

      // The following only means that the call tried to execute
      // - it doesn't necessarily mean that it got the lock
      // and ACTUALLy executed/won the function call
      // so tldr: it means: all deps were ready and the call was "tried"
      hadInitialCallRef.current = true;
      refreshFuncRef.current(true);
    }, [refreshFuncRef, ...(waitFor || [])]);

    return {
      refresh: () => refreshFuncRef.current(false),
      isFetching,
      data: stateData,
    };
  };

  return { useStore, getSnapshot, update, useFetchData };
};

export const create = createStore;
