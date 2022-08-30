# _Unglitch_ - another store?

Yes. React 18+ only and not planning to port to anything else. Get your sh\*t up-to-date. No Context Provider needed, hooks only.

![](https://media.giphy.com/media/PIRACM2jXRAP1l77tt/giphy.gif)

## Simple Usage

1. `npm i unglitch`
2. ```ts
   // Filename: store.ts
   type GlobalState = {
     user?: {
       prename: string;
       lastname: string;
       mail?: string;
     };
   };

   const state: GlobalState = {
     user: {
       prename: "Spongebob",
       lastname: "Squarepants",
     },
   };

   export const { useStore, update } = create<GlobalState>(() => state);
   ```

3. ```tsx
   // Filename: MyApp.ts
   import { useStore, update } from "./store";

   function App() {
     const [prename] = useStore((state) => state?.user.prename);

     return <div>{prename}</div>;
   }
   ```

## Getting the most recent state

## Lock-or-Leave, Lock'n'Release

This mechanism was invented primarily for singleton-like-fetching data but probably has more use-cases. It's not a new idea, it's a token-based lock.

It tries to avoid side-effects of multiple, unnecessary fetches when working with different, independent components. The idea is extremely simple: Everyone can try to fetch but only one will be able to do so and update everyone. Simple, right?

### Explanation Code

```tsx
import { useStore, update } from "./store";

const fetchUserData(releaseLock: () => void, currentUserInState) {
  if (currentUserInState) {
    // somehow state already has the user, do not fetch
    return;
  }

  fetch('/api/user')
    .then(r => r.json())
    .then(jsonData => {
      update({user: jsonData}); // first level gets merged, so dont worry
    })
    .finally(releaseLock);
}
fetchUserData.LOCK_TOKEN = "FETCH_USER_DATA";
// this is cool, aint it? it will we be automatically grabbed and if a function with
// that token is already running it will prevent another one running

export function useUser() {
  const [user, lockedCall] = useStore(state => state.user);

  useEffect(() => {
    if (!user) {
      // if we don't have user data we want to fetch it
      // we use the call locker that will make sure no matter
      // how often this Hook is used it will always prevent
      // calling another fetchUserData until it has been released again
      lockedCall(fetchUserData);
    }
  }, [user]);

  return user;
}



function MyComponent() {
  const user = useUser();
  // ...
}
```

## Getting the whole state

That's simple:

```tsx
import { getSnapshot } from "./store";

function MyComponent() {
  const state = getSnapshot(); // that's it. You can call this wherever you want
}
```

## Motivation: The Why

tl;dr:

- I liked the general readability of `zustand` (https://github.com/pmndrs/zustand) - but it was still too big for my needs
- I wanted a dependency-free store (less maintenance, yay!)
- I wanted a store solving the Problem of ever-recurring side-effects: I call it **Lock-or-Leave**

## What does it do?

- It uses the newest `React@18.x` changes to establish a Lifecycle-Connection between React and the Store
- It comes with a minimal `lock-and-release` System to avoid unwanted side-effects.
- It allows to have a local state derived from the global state (same as `zustand`).

## Why the Name `unglitch` ?

When not taking enough care you simply start triggering actions as part of your React Lifecycle. Then you reuse components and boom suddenly Lifecycle changes happen more often than you want and e.g. you start fetching the same data multiple times because the hooks all trigger fetching in the same Lifecycle but in different instances. This causes glitches and worst-case: application failure.

This is what this store with its lock mechanism wants to prevent.

## Caution

This is still pretty much alpha. I created it primarily for my own needs but I'm happy for contributions.

## Contribution Guidelines

Not much but the goal is to keep this free from dependencies (besides `fast-deep-equal`) (I don't have a problem with `devDependencies` tho).
