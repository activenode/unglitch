import equal from "fast-deep-equal";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

type UnlockFn = () => boolean;
type LockToken = Symbol | string;

const nonNullOrUndefined = (i: any) => i !== null && i !== undefined;

const createStore = <GlobalState extends object = {}>(
  initialState: () => GlobalState
) => {
  type PartialState = Partial<GlobalState>;
  type PartialStateReturner = (state: GlobalState) => PartialState;

  let state: GlobalState = initialState();
  const locks = new Map<LockToken, boolean>();
  const getSnapshot = () => state;

  // ===============================

  const listeners = new Set<() => void>();

  const triggerSubscribers = () => {
    listeners.forEach((fn) => fn());
  };

  const update = (updater: PartialStateReturner | PartialState) => {
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
    if (!equal(state, newState)) {
      state = newState;
      triggerSubscribers();
    }
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
    FuncParams extends readonly R[]
  >(
    fetchFunc: (
      set: typeof update,
      ...funcParams: Readonly<FuncParams>
    ) => Promise<T>,
    {
      waitFor,
      token,
      allow,
    }: {
      waitFor?: FuncParams;
      token?: LockToken;
      allow?: (isInitialCall: boolean) => boolean;
    } = {}
  ) => {
    let _token: LockToken = token ?? Symbol();
    const _waitFor: FuncParams | [] = waitFor || [];
    const waitForDeps = useRef<FuncParams | readonly []>(_waitFor);
    const hadInitialCallRef = useRef(false);

    useEffect(() => {
      waitForDeps.current = _waitFor;
    }, [..._waitFor]);

    const refresh = useCallback(
      (isInitialCall = false) => {
        if (!waitForDeps.current.every(nonNullOrUndefined)) {
          return;
        }

        if (allow && !allow(isInitialCall)) {
          return; // not allowed to execute
        }

        const unlocker = getLock(_token as LockToken);

        if (unlocker) {
          // then and ONLY then the lock is currently free!
          // console.log("[Debug]: Lock is free, call it ; Token =", token);
          fetchFunc(update, ...(waitForDeps.current as FuncParams)).finally(
            unlocker
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

    return () => refresh(false);
  };

  return { useStore, getSnapshot, update, useFetchData };
};

export const create = createStore;
