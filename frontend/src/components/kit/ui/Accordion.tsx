// Origin: the in-house design system, src/components/ui/Accordion.tsx. Copied to keep this app native to the design system.
//
// Only change: @/components/ -> @/components/kit/.
import * as Primitive from "@radix-ui/react-accordion";
import { cn } from "@/helpers/common/cn";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/kit/ui/Icon";
import { type ComponentProps, type ComponentRef, forwardRef } from "react";

const AccordionHeader = Primitive.Header;

type AccordionTriggerProps = ComponentProps<typeof Primitive.Trigger>;
type AccordionTriggerRef = ComponentRef<typeof Primitive.Trigger>;
type AccordionContentProps = ComponentProps<typeof Primitive.Content>;
type AccordionContentRef = ComponentRef<typeof Primitive.Content>;

export const Accordion = Primitive.Root;
export const AccordionItem = Primitive.Item;

export const AccordionTrigger = forwardRef<
  AccordionTriggerRef,
  AccordionTriggerProps
>(({ className, children, style, ...props }, ref) => (
  <AccordionHeader className="flex">
    <Primitive.Trigger
      ref={ref}
      className={cn(
        "group flex w-full min-h-8 min-w-8 items-center justify-between text-left",
        className,
      )}
      style={style}
      {...props}
    >
      <span className="flex flex-1 items-center gap-1.5">{children}</span>
      <Icon
        icon={ArrowRight01Icon}
        size={15}
        className="transition-transform duration-200 group-data-[state=open]:rotate-90"
      />
    </Primitive.Trigger>
  </AccordionHeader>
));
AccordionTrigger.displayName = "AccordionTrigger";

export const AccordionContent = forwardRef<
  AccordionContentRef,
  AccordionContentProps
>(({ className, children, ...props }, ref) => (
  <Primitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up",
      className,
    )}
    {...props}
  >
    {children}
  </Primitive.Content>
));
AccordionContent.displayName = "AccordionContent";
