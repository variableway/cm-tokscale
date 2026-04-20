/**
 * OpenCode-style Knight Rider Spinner
 * Accurate port from: https://github.com/sst/opencode/blob/dev/packages/opencode/src/cli/cmd/tui/ui/spinner.ts
 *
 * Features:
 * - Bidirectional sweep (left→right→left)
 * - Hold frames at each end (pause effect)
 * - Color gradient trail using ANSI 256 colors
 * - Same characters as OpenCode: ■ (active) / ⬝ (inactive)
 */

// =============================================================================
// ANSI Color Helpers
// =============================================================================

function ansi256Fg(code: number): string {
  return `\x1b[38;5;${code}m`;
}

const RESET = "\x1b[0m";
const HIDE_CURSOR = "\x1B[?25l";
const SHOW_CURSOR = "\x1B[?25h";
const CLEAR_LINE = "\r\x1B[K";

// =============================================================================
// Color Gradients (ANSI 256)
// Approximates OpenCode's RGBA alpha-based trail fade
// =============================================================================

type ColorName = "cyan" | "green" | "magenta" | "yellow" | "red" | "blue" | "white";

const COLOR_GRADIENTS: Record<ColorName, number[]> = {
  // Bright → dim (6 steps for trail)
  cyan: [51, 44, 37, 30, 23, 17],
  green: [46, 40, 34, 28, 22, 22],
  magenta: [201, 165, 129, 93, 57, 53],
  yellow: [226, 220, 214, 178, 136, 94],
  red: [196, 160, 124, 88, 52, 52],
  blue: [33, 27, 21, 18, 17, 17],
  white: [255, 250, 245, 240, 236, 232],
};

const INACTIVE_COLOR = 240; // Gray for ⬝

// =============================================================================
// Frame Generation (matches OpenCode exactly)
// =============================================================================

interface SpinnerOptions {
  /** Width of the spinner in characters (default: 8) */
  width?: number;
  /** Frames to hold at start position (default: 30) */
  holdStart?: number;
  /** Frames to hold at end position (default: 9) */
  holdEnd?: number;
  /** Trail length - number of colored blocks behind lead (default: 4) */
  trailLength?: number;
  /** Color theme (default: "cyan") */
  color?: ColorName;
  /** Frame interval in ms (default: 40) */
  interval?: number;
}

interface ScannerState {
  activePosition: number;
  isMovingForward: boolean;
}

/**
 * Calculate scanner state for a given frame index
 * Matches OpenCode's getScannerState() exactly
 */
function getScannerState(
  frameIndex: number,
  width: number,
  holdStart: number,
  holdEnd: number
): ScannerState {
  const forwardFrames = width;
  const backwardFrames = width - 1;
  const totalCycle = forwardFrames + holdEnd + backwardFrames + holdStart;

  // Normalize frame index to cycle
  const normalizedFrame = frameIndex % totalCycle;

  if (normalizedFrame < forwardFrames) {
    // Phase 1: Moving forward (0 → width-1)
    return {
      activePosition: normalizedFrame,
      isMovingForward: true,
    };
  } else if (normalizedFrame < forwardFrames + holdEnd) {
    // Phase 2: Holding at end
    return {
      activePosition: width - 1,
      isMovingForward: true,
    };
  } else if (normalizedFrame < forwardFrames + holdEnd + backwardFrames) {
    // Phase 3: Moving backward (width-2 → 0)
    const backwardIndex = normalizedFrame - forwardFrames - holdEnd;
    return {
      activePosition: width - 2 - backwardIndex,
      isMovingForward: false,
    };
  } else {
    // Phase 4: Holding at start
    return {
      activePosition: 0,
      isMovingForward: false,
    };
  }
}

/**
 * Generate a single frame string with colors
 */
function generateColoredFrame(
  frameIndex: number,
  width: number,
  holdStart: number,
  holdEnd: number,
  trailLength: number,
  gradient: number[]
): string {
  const state = getScannerState(frameIndex, width, holdStart, holdEnd);
  const { activePosition, isMovingForward } = state;

  let result = "";

  for (let i = 0; i < width; i++) {
    // Calculate directional distance (positive = trailing behind)
    const directionalDistance = isMovingForward
      ? activePosition - i // Forward: trail is to the left
      : i - activePosition; // Backward: trail is to the right

    if (directionalDistance >= 0 && directionalDistance < trailLength) {
      // Active position with color gradient
      const colorIdx = Math.min(directionalDistance, gradient.length - 1);
      result += ansi256Fg(gradient[colorIdx]) + "■" + RESET;
    } else {
      // Inactive position
      result += ansi256Fg(INACTIVE_COLOR) + "⬝" + RESET;
    }
  }

  return result;
}

/**
 * Calculate total frames in one complete cycle
 */
function getTotalFrames(width: number, holdStart: number, holdEnd: number): number {
  return width + holdEnd + (width - 1) + holdStart;
}

// =============================================================================
// Spinner Class
// =============================================================================

export class Spinner {
  private intervalId: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private width: number;
  private holdStart: number;
  private holdEnd: number;
  private trailLength: number;
  private gradient: number[];
  private interval: number;
  private message: string = "";
  private totalFrames: number;

  constructor(options: SpinnerOptions = {}) {
    this.width = options.width ?? 8;
    this.holdStart = options.holdStart ?? 30;
    this.holdEnd = options.holdEnd ?? 9;
    this.trailLength = options.trailLength ?? 4;
    this.interval = options.interval ?? 40;

    const colorName = options.color ?? "cyan";
    this.gradient = COLOR_GRADIENTS[colorName] || COLOR_GRADIENTS.cyan;

    this.totalFrames = getTotalFrames(this.width, this.holdStart, this.holdEnd);
  }

  /**
   * Start the spinner with a message
   */
  start(message: string): void {
    this.message = message;
    this.frameIndex = 0;

    // Hide cursor
    process.stdout.write(HIDE_CURSOR);

    this.intervalId = setInterval(() => {
      const frame = generateColoredFrame(
        this.frameIndex,
        this.width,
        this.holdStart,
        this.holdEnd,
        this.trailLength,
        this.gradient
      );

      process.stdout.write(`${CLEAR_LINE}  ${frame} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.totalFrames;
    }, this.interval);
  }

  /**
   * Update the spinner message while running
   */
  update(message: string): void {
    this.message = message;
  }

  /**
   * Stop the spinner and show a success message
   */
  success(message: string): void {
    this.stop();
    console.log(`  \x1b[32m✓\x1b[0m ${message}`);
  }

  /**
   * Stop the spinner and show an error message
   */
  error(message: string): void {
    this.stop();
    console.log(`  \x1b[31m✗\x1b[0m ${message}`);
  }

  /**
   * Stop the spinner without a message
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    process.stdout.write(CLEAR_LINE);
    process.stdout.write(SHOW_CURSOR);
  }

  /**
   * Check if spinner is currently running
   */
  isSpinning(): boolean {
    return this.intervalId !== null;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a spinner with default OpenCode settings
 */
export function createSpinner(options?: SpinnerOptions): Spinner {
  return new Spinner(options);
}

/**
 * Run an async function with a spinner
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>,
  options?: SpinnerOptions & { successMessage?: string; errorMessage?: string }
): Promise<T> {
  const spinner = new Spinner(options);
  spinner.start(message);

  try {
    const result = await fn();
    spinner.success(options?.successMessage ?? message);
    return result;
  } catch (error) {
    spinner.error(options?.errorMessage ?? `Failed: ${message}`);
    throw error;
  }
}
