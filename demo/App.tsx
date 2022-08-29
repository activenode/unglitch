import React from "react";
import { useStore } from "./store";

export function App() {
  const [foo] = useStore((state) => state.foo);

  return <div>Foo is currently {foo ? "true" : "false"}</div>;
}
