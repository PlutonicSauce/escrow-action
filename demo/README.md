# Escrow demo fixtures

`sample-monorepo/` is the tracked, intentionally broken source fixture. Do not
run repair apply against that tracked directory. Create a disposable committed
Git repository instead:

```bash
npm run demo:reset
escrow ui .escrow-demo/sample-monorepo --model gpt-5.6-terra
```

The reset command deletes and recreates only `.escrow-demo/`, which is ignored
by Git. Run it again after any applied repair to restore the four deterministic
failures. The Escrow source checkout remains unchanged.
