import equal from "fast-deep-equal";
import { useCallback, useSyncExternalStore } from "react";

type UnlockFn = () => boolean;
type LockToken = Symbol | string;

const UNGLITCH_LOCK_TOKEN = "UNGLITCH_LOCK_TOKEN";

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
  const useFetchData = <R extends unknown, T extends unknown>(
    fetchFunc: (set: any) => Promise<T>,
    LOCK_TOKEN?: LockToken
  ) => {
    let token: LockToken = LOCK_TOKEN ?? Symbol();

    const refresh = useCallback(() => {
      const unlocker = getLock(token as LockToken);

      if (unlocker) {
        // then and ONLY then the lock is currently free!
        console.log("[Debug]: Lock is free, call it ; Token =", token);

        fetchFunc(update).finally(unlocker); // when it's done, we unlock
      }
    }, [fetchFunc]);

    refresh();
    return refresh;
  };

  return { useStore, getSnapshot, update, useFetchData };
};

export const create = createStore;
