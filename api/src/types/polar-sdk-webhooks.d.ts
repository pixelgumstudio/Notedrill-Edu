// @polar-sh/sdk's package.json "exports" map only resolves the "./webhooks"
// subpath under TypeScript's "node16"/"nodenext"/"bundler" moduleResolution.
// This project uses classic "node" resolution (shared across the whole api
// workspace — not something to change for one import), which can't see that
// map. Node's own runtime resolution handles "@polar-sh/sdk/webhooks" fine
// (verified directly), so only the *type-checking* needs help: re-export the
// real types from the deep compiled path, which classic resolution can reach.
declare module '@polar-sh/sdk/webhooks' {
  export * from '@polar-sh/sdk/dist/commonjs/webhooks';
}
