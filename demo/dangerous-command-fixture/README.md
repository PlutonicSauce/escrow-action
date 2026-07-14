# Dangerous-command fixture

This fixture exists only to demonstrate deterministic blocking. AgentContract
classifies `git push origin main` as prohibited before execution. The command
must never be run manually or by the demo.
