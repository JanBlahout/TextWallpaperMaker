import { useEffect, useEffectEvent, type RefObject } from "react";

/**
 * Calls `onChange` with the input on its native `change` event. React's
 * onChange fires on every `input` event instead; for a colour picker or a
 * slider, the native `change` fires once it's released or closed, so it's
 * when a change is committed.
 */
export function useNativeChange(ref: RefObject<HTMLInputElement | null>, onChange: (input: HTMLInputElement) => void) {
  const handleChange = useEffectEvent(onChange);

  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const listener = () => handleChange(input);
    input.addEventListener("change", listener);
    return () => input.removeEventListener("change", listener);
  }, [ref]);
}
