## 1. Apply Lifecycle

- [x] 1.1 Add a service-level apply function that promotes `pending_config` into `current_config`
- [x] 1.2 Connect an explicit control-path trigger so apply can be invoked from the FAT16 control plane
- [x] 1.3 Extend `STATUS.TXT` reporting so apply completion and dirty-state clearing are visible

## 2. Runtime Behavior Integration

- [x] 2.1 Ensure `/ROM/CURRENT.GBA` continues using `current_config` before apply and uses new values after apply
- [x] 2.2 Split save reads into SRAM, FRAM, and FLASH-specific helper paths
- [x] 2.3 Ensure `/RAM/CURRENT.SAV` dispatches by applied `current_config.ram_type`, not pending state

## 3. Verification

- [x] 3.1 Verify config edits alone do not change active ROM export or save-read behavior
- [x] 3.2 Verify apply causes current/pending convergence and updates runtime behavior
- [x] 3.3 Verify SRAM, FRAM, and FLASH all hit distinct read-path branches
