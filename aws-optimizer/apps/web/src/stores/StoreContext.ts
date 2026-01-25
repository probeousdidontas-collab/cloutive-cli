import { createContext } from "react";
import type { RootStore } from "./RootStore";

// React Context for MobX stores
export const StoreContext = createContext<RootStore | null>(null);
