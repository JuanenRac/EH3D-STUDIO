/* The copy of the settings contract of the server that Studio keeps (src/data/settings-contract.json), used when the live contract cannot be read. The file is checked against the one of
 * EH3D-SERVER by tools/sync_settings_contract.py and by the tests. GPL-3.0-or-later. */
import embedded from "../data/settings-contract.json";
import type { SettingsContract } from "./settingscontract";

export const EMBEDDED_CONTRACT = embedded as unknown as SettingsContract;
