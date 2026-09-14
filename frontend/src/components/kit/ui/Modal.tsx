// Origin: the in-house design system, src/components/ui/Modal.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/; @/helpers/i18n/useTranslation -> @/helpers/i18n/useTranslation.
import {
  Root as Dialog,
  Close as DialogClose,
  Content as DialogContentPrimitive,
  Overlay as DialogOverlayPrimitive,
  Portal as DialogPortal,
  Title as DialogTitlePrimitive,
} from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/kit/ui/Button";
import { ContextLayout } from "@/context";
import { getTheme } from "@/helpers/common/theme";
import { cn } from "@/helpers/common/cn";
import { ModalProps } from "@/types/entities";
import { Icon } from "@/components/kit/ui/Icon";
import { PopoverContainerProvider } from "@/components/kit/ui/Popover";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import useTranslation from "@/helpers/i18n/useTranslation";
import { useContext, useState } from "react";

export function Modal({
  title,
  isOpen,
  onClose,
  onSubmit,
  loading,
  disabled,
  content,
  footer,
  buttonText,
  danger,
  className,
  overlayClassName,
  hideHeader,
}: ModalProps) {
  const { t } = useTranslation("common");
  const { theme } = useContext(ContextLayout) ?? {};
  const [contentNode, setContentNode] = useState<HTMLDivElement | null>(null);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlayPrimitive
          className={cn(
            "fixed inset-0 z-50 bg-black/95 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            overlayClassName,
          )}
        />
        <DialogContentPrimitive
          ref={setContentNode}
          data-theme={getTheme(theme)}
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 text-text bg-background p-4 duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] rounded-xl",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "w-full min-w-sm border border-borderDark max-w-sm lg:min-w-xl lg:max-w-xl",
            !hideHeader && "space-y-3",
            className,
          )}
        >
          <PopoverContainerProvider value={contentNode}>
            {hideHeader ? (
              <VisuallyHidden asChild>
                <DialogTitlePrimitive>{title}</DialogTitlePrimitive>
              </VisuallyHidden>
            ) : (
              <DialogTitlePrimitive
                className={cn(
                  "flex items-center justify-between gap-2",
                  title && "border-b border-borderDark pb-3",
                )}
              >
                <span className="font-semibold">{title}</span>
                <DialogClose asChild>
                  <Button
                    size="small"
                    justifyContent="center"
                    icon={<Icon icon={Cancel01Icon} />}
                    aria-label={t("Close")}
                  />
                </DialogClose>
              </DialogTitlePrimitive>
            )}
            {content ? (
              <div
                className={cn(
                  hideHeader ? "h-full min-h-0" : "space-y-3 text-sm",
                )}
              >
                {content}
              </div>
            ) : null}
            {onSubmit && !footer ? (
              <div className="flex justify-between items-center gap-2">
                <div className="flex w-full justify-end gap-2">
                  <Button label={t("Discard")} onClick={onClose} />
                  <Button
                    variant={danger ? "danger" : "outline"}
                    loading={loading}
                    label={buttonText || t("Submit")}
                    disabled={disabled}
                    onClick={onSubmit}
                    type="submit"
                  />
                </div>
              </div>
            ) : footer ? (
              <div className="flex justify-between items-center gap-2">
                {footer}
              </div>
            ) : null}
          </PopoverContainerProvider>
        </DialogContentPrimitive>
      </DialogPortal>
    </Dialog>
  );
}
