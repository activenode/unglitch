import React, { useEffect, useState } from "react";
import { useStore, useFetchData, update } from "./store";

const wait = (fn, ms) => {
  return new Promise((res) => {
    setTimeout(() => {
      res(fn());
    }, ms);
  });
};

export function App() {
  const [todos] = useStore((s) => s.todos);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const timeGlitch = useFetchData(
    async () => {
      return new Date().toLocaleTimeString();
    },
    {
      refreshInterval: 1000,
      data: (s) => s.time,
      onSuccess: (update, data) => update({ time: data }),
    }
  );

  return (
    <>
      <div>Time: {timeGlitch.data}</div>

      <div style={{ paddingTop: "3rem", maxWidth: "300px" }}>
        <h2>Todos</h2>

        <input type="text" ref={inputRef} />

        <button
          role="button"
          type="button"
          onClick={() => {
            const currentValue = inputRef.current?.value;

            if (!currentValue || currentValue.length === 0) {
              return;
            }

            inputRef.current.value = "";

            update.merge({
              todos: [currentValue],
            });
          }}
        >
          Add ToDo
        </button>

        <ul>
          {todos.map((todo, i) => (
            <li key={i}>{todo}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
