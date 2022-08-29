import { create } from "../src";

type MyState = {
  foo: boolean;
  bar: string;
};

const store = create<MyState>(() => ({
  foo: false,
  bar: "hello",
}));

export const { useStore, getSnapshot, update } = store;
