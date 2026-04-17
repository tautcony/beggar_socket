## ADDED Requirements

### Requirement: GBAMultiMenuView Layout Orchestrator

GBAMultiMenuView.vue SHALL serve as a layout orchestrator that composes sub-components without containing domain logic.

#### Scenario: View size constraint

WHEN GBAMultiMenuView.vue is refactored
THEN it SHALL NOT exceed 250 lines of code (template + script + style)

#### Scenario: View composition

WHEN GBAMultiMenuView.vue renders
THEN it SHALL compose `GameRomPanel`, `SaveFilePanel`, `BgImageUploader`, and `RomBuildPanel` sub-components
AND distribute shared state via props or v-model bindings
AND retain only page-level layout (header, loading overlay, content grid) in its own template

### Requirement: GameRomPanel Component

A `GameRomPanel` component SHALL encapsulate all game ROM list management functionality.

#### Scenario: Game ROM list display

WHEN games are provided via props
THEN GameRomPanel SHALL render the game list with drag-and-drop file addition, sorting, and deletion controls

#### Scenario: Game configuration editing

WHEN a user edits a game's configuration (e.g., save type, ROM size)
THEN GameRomPanel SHALL emit the updated game configuration to the parent

#### Scenario: File drop handling

WHEN ROM files are dropped onto the game panel
THEN GameRomPanel SHALL validate file types and emit added games

### Requirement: SaveFilePanel Component

A `SaveFilePanel` component SHALL encapsulate all save file management functionality.

#### Scenario: Save file list display

WHEN save files are provided via props
THEN SaveFilePanel SHALL render the save file list with drag-and-drop addition and deletion controls

#### Scenario: Save file addition

WHEN save files are dropped onto the panel
THEN SaveFilePanel SHALL validate file types and emit updated save file list

### Requirement: BgImageUploader Component

A `BgImageUploader` component SHALL encapsulate background image upload, crop, and preview functionality.

#### Scenario: Image upload

WHEN a user uploads a background image
THEN BgImageUploader SHALL process the image and emit the processed result via v-model

#### Scenario: Image preview

WHEN a user requests background image preview
THEN BgImageUploader SHALL display the preview modal within its own template

### Requirement: RomBuildPanel Component

A `RomBuildPanel` component SHALL encapsulate build configuration, build execution trigger, and result download.

#### Scenario: Build configuration display

WHEN build configuration props are provided
THEN RomBuildPanel SHALL render menu ROM selection, basic configuration options, and the build button

#### Scenario: Build trigger

WHEN the user clicks the build button
THEN RomBuildPanel SHALL emit a build event to the parent
AND display build progress during execution

#### Scenario: Result download

WHEN a build result is available
THEN RomBuildPanel SHALL render the download area with the built ROM information

### Requirement: useMultiMenuState Composable

A `useMultiMenuState()` composable SHALL centralize the shared reactive state for the multi-menu view.

#### Scenario: State initialization

WHEN `useMultiMenuState()` is called
THEN it SHALL return reactive references for: games list, save files list, background image, build configuration, build result, and loading state

#### Scenario: Build orchestration

WHEN a build is triggered via the composable
THEN it SHALL coordinate the ROM assembly process using the existing build logic
AND update the build result state upon completion

### Requirement: Behavioral Equivalence

The refactored component tree SHALL produce identical user-visible behavior to the pre-refactor monolithic view.

#### Scenario: UI rendering equivalence

WHEN the refactored GBAMultiMenuView is rendered
THEN the DOM structure, styling, and interactive behavior SHALL be indistinguishable from the pre-refactor version

#### Scenario: i18n key preservation

WHEN the refactored components reference i18n keys
THEN they SHALL use the same keys as the pre-refactor implementation with no additions or removals
