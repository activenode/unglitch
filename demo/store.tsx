import { createStore } from "../src"; // from '@activenode/glitch';

type MyState = {
  foo: boolean;
  bar: string;
};

const store = createStore<MyState>(() => ({
  foo: false,
  bar: "hello",
}));

export const { useZustand, getSnapshot, update } = store;
