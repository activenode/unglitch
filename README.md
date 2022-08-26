# Glitch - another store?

Yes. React 18+ only and not planning to port to anything else. Get your sh*t up-to-date.

## Motivation: The Why

tl;dr: 
- I liked the general readability of `zustand` (https://github.com/pmndrs/zustand) - but it was still too big for my needs
- I wanted a dependency-free store (less maintenance, yay!)
- I wanted a store solving the Problem of ever-recurring side-effects: I call it **Lock-or-Leave**

## What does it do?

- It uses the newest `React@18.x` changes to establish a Lifecycle-Connection between React and the Store
- It comes with a minimal `lock-and-release` System to avoid unwanted side-effects.
- It allows to have a local state derived from the global state (same as `zustand`).

## Why the Name `glitch` ?

When not taking enough care you simply start triggering actions as part of your React Lifecycle. Then you reuse components and boom suddenly Lifecycle changes happen more often than you want and e.g. you start fetching the same data multiple times because the hooks all trigger fetching in the same Lifecycle but in different instances. This causes glitches and worst-case: application failure.

This is what this store with its lock mechanism wants to prevent.

## Caution

This is still pretty much alpha. I created it primarily for my own needs but I'm happy for contributions.

## Contribution Guidelines

Not much but the goal is to keep this free from dependencies (I don't have a problem with `devDependencies` tho).
