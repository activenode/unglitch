import React from "react";
import { useZustand } from "./store";

export function App() {
  const foo = useZustand((state) => state.foo);

  return <div>Foo is currently {foo ? "true" : "false"}</div>;
}
