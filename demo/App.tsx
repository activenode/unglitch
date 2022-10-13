import React, { useEffect, useState } from "react";
import { useStore, useFetchData } from "./store";

const promiseTimeout = (fn, ms) => {
  return new Promise((res) => {
    console.log("inside promise");
    setTimeout(() => {
      console.log("inside timeout");
      res(fn());
    }, ms);
  });
};

export function App() {
  const [[foo, bar], getRealtimeState] = useStore((state) => [
    state.foo,
    state.bar,
  ]);

  const [waitSampleValue, setWaitSampleValue] = useState<boolean | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setWaitSampleValue(true);
    }, 3000);

    return () => clearTimeout(t);
  });

  const refresh = useFetchData(
    (set, ...functionParams) => {
      return promiseTimeout(() => {
        const sampleValue = functionParams[0];
        const keksValue = functionParams[2];

        console.log(
          "promiseTimeout is called",
          waitSampleValue,
          "should be true",
          { sampleValue, keksValue }
        );

        // const realtimeState = getRealtimeState();
        // const [, beforeBar] = realtimeState;

        set({
          bar: `The current time is  ${new Date().toLocaleTimeString()} `,
        });
      }, 1500);
    },
    {
      token: "UNIQUE_TOKEN",
      waitFor: [waitSampleValue, false, "keks"] as const,
      allow: (isInitialCall) => {
        console.log({ isInitialCall });
        return isInitialCall;
      },
    }
  );

  console.log({ waitSampleValue });

  useEffect(() => {
    const i = setInterval(() => {
      refresh();
    }, 20);
    // this is not clever but its super-safe as the fetching will only be called
    // when the previous one is released
    return () => window.clearInterval(i);
  }, []);

  return (
    <>
      <div>Foo is currently {foo ? "true" : "false"}</div>
      <p>Bar = "{bar}"</p>
    </>
  );
}
