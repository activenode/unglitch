# _Unglitch_ - another store?

Yes. React 18+ only and not planning to port to anything else. Get your sh\*t up-to-date. No Context Provider needed, hooks only.

**But will there be Support for Vanilla, Vue, Stencil, etc?**
Maybe. Not the highest prio on my roadmap but shouldn't be a big deal to provide it. Feel free to contribute.

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

const fetchUserData = async (set) => {
  return fetch("/api/user")
    .then((r) => r.json())
    .then((jsonData) => {
      set({ user: jsonData }); // first level gets merged, so dont worry
    });
};

export function useUser() {
  const [user, getRealtimeUserState] = useStore((state) => state.user);

  const refreshUserDataAgain = useFetchData((set) => {
    // we just wanna make sure to make a check that there wasn't
    // another processing updating the user already hence the user
    // would be already in the state
    const realtimeUserState = getRealtimeUserState();
    if (!realtimeUserState) {
      return fetchUserData(set);
    }
  });

  return user;
}

function MyComponent() {
  const user = useUser();
  // ...
}
```

### Understanding `useFetchData` and it's refresh function

`useFetchData` is more than just for "server fetching". It's for any kind of data processing that will take more time than "immediate" execution. And it ensures via the `LOCK_TOKEN` system that you can call it as often as you want without being scared that it will be ran too often. It can't. It's locked until the returned Promise is released (either through error or through successfully resolving it).

Now assume you are loading news data from a blog

```tsx
const [articles] = useStore((state) => state.articles);
```

but we also need to fetch them, right?

```tsx
const refreshArticles = useFetchData(async (set) => {
  const articles = await loadArticles();
  set({ articles });
});
```

Now this will make sure that data is loaded initially but since the function is anonymous `async (set) ...` we have the problem that the system can't know that this is the same function when being called again in another instance of a component. So we need a `LOCK_TOKEN` in here.

```tsx
const refreshArticles = useFetchData(async (set) => {
  const articles = await loadArticles();
  set({ articles });
}, "REFRESH_ARTICLES" /** here we go **/);
```

Now we're good to go. The function will be called exactly once initially and will block any other calls to it until resolved. You can bruteforce-check this behaviour by using the `refreshArticles` function.

This would call and update the `loadArticles` again - but only if the previous one is done. If not, it get's thrown away. This makes sense because when loading articles is still processing you don't want to start another process.

For initial loading, the best performance is achieved when you combine it with local state reduction as seen above and grab the most recent local state to check if it's **actually** empty (if you know your own architecture you probably don't need this but if you work in a big environment this is useful):

```tsx
const [articles, getRealtimeArticlesState] = useStore(
  (state) => state.articles
);

const refreshArticles = useFetchData(async (set) => {
  if (!getRealtimeArticlesState()) {
    // data is clearly EMPTY !
    const articles = await loadArticles();
    set({ articles });
  }
}, "REFRESH_ARTICLES" /** here we go **/);
```

This sample however will never ever be able to refresh the articles because at the first point where
data is not empty it will never execute `loadArticles()` again.

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
