# Bounty Hunter Protocol

Automated binary path analysis and symbolic execution module authored by Dalton Rosenberg for Project Nexus / Sovereign Hive.

## Functionality
* Leverages `angr` and `claripy` for symbolic constraint solving and AST generation.
* Automated path exploration to find execution routes reaching specific code coordinates (`target_address`) while avoiding forbidden branches (`avoid_addresses`).

## Requirements
```bash
pip install angr claripy
```
