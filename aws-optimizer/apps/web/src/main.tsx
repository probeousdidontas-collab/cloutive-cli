import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { theme } from "./lib/theme";
import { ConvexClientProvider } from "./lib/convex";
import { StoreProvider } from "./stores";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexClientProvider>
      <MantineProvider theme={theme}>
        <Notifications position="top-right" />
        <StoreProvider>
          <RouterProvider router={router} />
        </StoreProvider>
      </MantineProvider>
    </ConvexClientProvider>
  </StrictMode>
);
