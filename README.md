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
