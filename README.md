# _Unglitch_ - another store?

**This library has 985 bytes itself (compressed with `brotli` which every browser supports).
Adding up its single dependency `fast-equals` it comes down to less than 3kb**

<img src="./logo.jpg" width="400px" 
style="max-width: 100%" alt="" />

Yes. React 18+ only and not planning to port to anything else. Get your sh\*t up-to-date. No Context Provider needed, hooks only.

**But will there be Support for Vanilla, Vue, Stencil, etc?**
Maybe. Not the highest prio on my roadmap but shouldn't be a big deal to provide it. Feel free to contribute.

- only dependency: fast-equals to avoid unnecessary updates
- list principles: own the data
- fetching can lead to multiple entries in the state, not one collected, which is nice
- you know what your app looks like so you know your store

## Getting Started

`npm i unglitch@latest`

### 1. Create your store

Coming soon, planning on providing CodeSandboxes. Since most of it is equal to the old version check out https://github.com/activenode/unglitch/blob/7f1e85e10d4cc730d1d65f139d7ed06cf4feef08/README.md
