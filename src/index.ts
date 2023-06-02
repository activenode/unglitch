import { deepEqual as equal } from "fast-equals";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

type UnlockFn = () => boolean;
type LockToken = symbol | string;
type TokenData = {
  isFetching: boolean;
  lastFetchAt: number;
  lastFetchError: null | any;
};
type TokenDataContainer = { [key: LockToken]: TokenData };

const nonNullOrUndefined = (i: any) => i !== null && i !== undefined;

const createStore = <GlobalState extends object = {}>(
  initialState: () => GlobalState
) => {
  const UNIQUE_STORE_SYMBOL: unique symbol = Symbol();

  type InternalState = GlobalState & {
    [UNIQUE_STORE_SYMBOL]: TokenDataContainer;
  };
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
    { forceUpdate = false }: { forceUpdate?: boolean } = {}
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
    update(updater, { forceUpdate: true });
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

  const getImmediateLockMetadata = (token: LockToken) => {
    const tokenDataContainer = (state as InternalState)[
      UNIQUE_STORE_SYMBOL
    ] as TokenDataContainer;
    return tokenDataContainer?.[token];
  };

  const useLockMetadata = (token: LockToken) => {
    const [{ isFetching, lastFetchAt }] = useStore((s) => {
      const tokenDataContainer = (s as InternalState)?.[
        UNIQUE_STORE_SYMBOL
      ] as TokenDataContainer;

      const tokenData = tokenDataContainer?.[token];

      return {
        isFetching: tokenData?.isFetching,
        lastFetchAt: tokenData?.lastFetchAt,
        lastFetchError: tokenData?.lastFetchError,
      };
    });

    const updateTokenMetadata = (metadata: Partial<TokenData>) => {
      forceUpdate((s) => {
        return {
          [UNIQUE_STORE_SYMBOL]: {
            ...((s as any)?.[UNIQUE_STORE_SYMBOL] as TokenDataContainer),
            [token]: {
              ...((s as any)?.[UNIQUE_STORE_SYMBOL]?.[token] as TokenData),
              ...metadata,
            },
          },
        } as any as PartialState;
      });
    };

    const setIsFetching = (isFetching: boolean) => {
      updateTokenMetadata({ isFetching });
    };

    const setLastFetchAt = (lastFetchAt: number) => {
      updateTokenMetadata({ lastFetchAt });
    };

    const setLastFetchError = (error: null | any) => {
      updateTokenMetadata({ lastFetchError: error });
    };

    return {
      isFetching,
      setIsFetching,
      lastFetchAt,
      setLastFetchAt,
      setLastFetchError,
    } as const;
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
      onSuccess,
      refreshInterval,
    }: {
      waitFor?: FuncParams;
      token?: LockToken;
      allow?: ((isInitialCall: boolean) => boolean) | "if-empty";
      data?: (s: GlobalState, isFetching?: boolean) => ReturnedState;
      onSuccess?: (set: typeof update, data: T) => void;
      refreshInterval?: number;
    } = {}
  ) => {
    let _token: LockToken = useMemo(() => token ?? Symbol(), [token]);
    const _waitFor: FuncParams | [] = waitFor || [];
    const waitForDeps = useRef<FuncParams | readonly []>(_waitFor);
    const hadInitialCallRef = useRef(false);
    const {
      isFetching,
      setIsFetching,
      lastFetchAt,
      setLastFetchAt,
      setLastFetchError,
    } = useLockMetadata(_token);
    const [stateData, realtimeStateData] = useStore(
      data ? (s) => data(s, isFetching) : () => undefined
    );
    const refreshFuncRef = useRef<(isInitialCall: boolean) => boolean>(
      () => false
    );

    useEffect(() => {
      waitForDeps.current = _waitFor;
    }, [..._waitFor]);

    const refresh = useCallback(
      (isInitialCall = false) => {
        // 1. check deps
        if (!waitForDeps.current.every(nonNullOrUndefined)) {
          return false;
        }

        // 2. check if still needs to wait (min wait time)
        if (refreshInterval) {
          const tokenData = getImmediateLockMetadata(_token as LockToken);

          if (tokenData?.lastFetchAt) {
            const now = Date.now();
            const diff = now - tokenData.lastFetchAt;

            if (diff < refreshInterval) {
              return false; // not allowed to execute
            }
          }
        }

        if (allow) {
          if (typeof allow === "function") {
            if (!allow(isInitialCall)) {
              return false; // not allowed to execute
            }
          } else if (allow === "if-empty") {
            const realtimeData = realtimeStateData();

            if (realtimeData !== null && realtimeData !== undefined) {
              return false; // not allowed to execute
            }
          }
        }

        const unlocker = getLock(_token as LockToken);

        if (unlocker) {
          setIsFetching(true);
          setLastFetchAt(Date.now());

          // then and ONLY then the lock is currently free!
          // console.log("[Debug]: Lock is free, call it ; Token =", token);
          fetchFunc(update, ...(waitForDeps.current as FuncParams))
            .then((value) => {
              setLastFetchError(undefined);
              onSuccess?.(update, value);
              return value;
            })
            .catch((e) => {
              console.error(e);
              setLastFetchError(e);
            })
            .finally(() => {
              unlocker();
              setIsFetching(false);
            }); // when it's done, we unlock

          return true;
        }

        return false;
      },
      [fetchFunc, allow]
    );

    useEffect(() => {
      refreshFuncRef.current = refresh;
    }, [refresh]);

    useEffect(() => {
      let interval: number;

      if (refreshInterval) {
        interval = setInterval(() => {
          refreshFuncRef.current(false);
        }, refreshInterval);
      }

      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }, [refreshInterval]);

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
      lastFetchAt,
    };
  };

  return { useStore, getSnapshot, update, useFetchData };
};

export const create = createStore;
