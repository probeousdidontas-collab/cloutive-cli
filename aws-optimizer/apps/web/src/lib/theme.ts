import { createTheme } from "@mantine/core";
import type { MantineColorsTuple } from "@mantine/core";

/**
 * Minimum touch target size for accessibility (WCAG 2.1 AA)
 * All interactive elements should be at least 44x44 pixels
 */
export const TOUCH_TARGET_SIZE = 44;

/**
 * AWS Optimizer brand color palette
 * Primary: AWS Orange for AWS branding theme
 */
const awsOrange: MantineColorsTuple = [
  "#fff4e6",
  "#ffe8cc",
  "#ffd8a8",
  "#ffc078",
  "#ffa94d",
  "#ff922b",
  "#fd7e14",
  "#f76707",
  "#e8590c",
  "#d9480f",
];

/**
 * Secondary color: Deep blue for contrast
 */
const deepBlue: MantineColorsTuple = [
  "#e7f5ff",
  "#d0ebff",
  "#a5d8ff",
  "#74c0fc",
  "#4dabf7",
  "#339af0",
  "#228be6",
  "#1c7ed6",
  "#1971c2",
  "#1864ab",
];

export const theme = createTheme({
  primaryColor: "awsOrange",
  colors: {
    awsOrange,
    deepBlue,
  },
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  headings: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  defaultRadius: "md",
  components: {
    Button: {
      defaultProps: {
        size: "md",
      },
      styles: {
        root: {
          minHeight: TOUCH_TARGET_SIZE,
        },
      },
    },
    TextInput: {
      defaultProps: {
        size: "md",
      },
      styles: {
        input: {
          minHeight: TOUCH_TARGET_SIZE,
        },
      },
    },
    NumberInput: {
      defaultProps: {
        size: "md",
      },
      styles: {
        input: {
          minHeight: TOUCH_TARGET_SIZE,
        },
      },
    },
    Select: {
      defaultProps: {
        size: "md",
      },
      styles: {
        input: {
          minHeight: TOUCH_TARGET_SIZE,
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        size: "lg",
      },
      styles: {
        root: {
          minWidth: TOUCH_TARGET_SIZE,
          minHeight: TOUCH_TARGET_SIZE,
        },
      },
    },
    NavLink: {
      styles: {
        root: {
          minHeight: TOUCH_TARGET_SIZE,
        },
      },
    },
    Checkbox: {
      styles: {
        root: {
          minHeight: TOUCH_TARGET_SIZE,
        },
        body: {
          alignItems: "center",
        },
      },
    },
    Switch: {
      styles: {
        root: {
          minHeight: TOUCH_TARGET_SIZE,
        },
        body: {
          alignItems: "center",
        },
      },
    },
  },
});
