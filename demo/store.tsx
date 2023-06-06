import { create } from "../src";

type MyState = {
  todos: string[];
  time: string;
};

const store = create<MyState>(() => ({
  todos: [],
  time: new Date().toLocaleTimeString(),
}));

export const { useStore, getSnapshot, update, useFetchData } = store;
