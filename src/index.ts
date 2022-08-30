import equal from "fast-deep-equal/es6";
import { useCallback, useSyncExternalStore } from "react";

type UnlockFn = () => boolean;
type LockToken = Symbol | string;

interface LockedCallFunc<R extends unknown> {
  (unlocker: UnlockFn, accurateLocalState: R): void;
  LOCK_TOKEN?: LockToken;
}

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

  const update = (fn: PartialStateReturner) => {
    const partialState = fn(state);

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
  ): [R, (fn: LockedCallFunc<R>, token?: LockToken) => void] => {
    // type LockedCallFunc = (
    //   unlocker: UnlockFn,
    //   accurateLocalState: R
    // ) => void & { LOCK_TOKEN?: LockToken };

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

    const _lockedTokenizedCall = (fn: LockedCallFunc<R>, token?: LockToken) => {
      let _token: Symbol | string | undefined = token;

      if (!_token) {
        _token = fn.LOCK_TOKEN;
      }

      if (!_token) {
        throw new Error(
          "Either provide a token as second param or add a LOCK_TOKEN property to your function"
        );
      }

      const unlocker = getLock(token as LockToken);

      if (unlocker) {
        // and only then...
        fn(unlocker, getLiveLocalSnapshot());
      }
    };

    return [reduceStateToLocalState(), _lockedTokenizedCall];
  };

  return { useStore, getSnapshot, update };
};

export const create = createStore;
