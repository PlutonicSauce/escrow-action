export type InstructionFileName = "AGENTS.md" | "AGENTS.override.md";

export interface InstructionFile {
  path: string;
  directory: string;
  fileName: InstructionFileName;
  content: string;
}

export interface InstructionDiscoveryResult {
  repositoryRoot: string;
  targetDirectory: string;
  instructionChain: InstructionFile[];
}
