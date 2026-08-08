/**
 * Responsive dialogs: DialogContent / AlertDialogContent are already
 * mobile-safe (near-full-screen + scrollable below sm). Re-export for
 * call sites that want an explicit Responsive* name.
 */
export {
  Dialog as ResponsiveDialog,
  DialogTrigger as ResponsiveDialogTrigger,
  DialogClose as ResponsiveDialogClose,
  DialogHeader as ResponsiveDialogHeader,
  DialogFooter as ResponsiveDialogFooter,
  DialogTitle as ResponsiveDialogTitle,
  DialogDescription as ResponsiveDialogDescription,
  DialogContent as ResponsiveDialogContent,
} from '@/components/ui/dialog';
