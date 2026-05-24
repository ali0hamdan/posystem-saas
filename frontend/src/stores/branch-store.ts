import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BranchLite = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

type BranchState = {
  branches: BranchLite[];
  selectedBranchId: string | null;
  hydrateBranches: (branches: BranchLite[]) => void;
  selectBranch: (id: string) => void;
  clearBranches: () => void;
};

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      branches: [],
      selectedBranchId: null,
      hydrateBranches: (branches) => {
        const prev = get().selectedBranchId;
        const stillValid = prev && branches.some((b) => b.id === prev && b.isActive);
        const nextId = stillValid ? prev! : (branches.find((b) => b.isActive)?.id ?? null);
        set({ branches, selectedBranchId: nextId });
      },
      selectBranch: (id) => set({ selectedBranchId: id }),
      clearBranches: () => set({ branches: [], selectedBranchId: null }),
    }),
    {
      name: 'pos-branch',
      partialize: (state) => ({ selectedBranchId: state.selectedBranchId }),
    },
  ),
);
