import { useEffect, useState } from 'react';

/**
 * Tracks whether a scroll container has moved past its top edge, for the
 * `.scroll-edge` fade (floating chrome should separate from content only
 * once there's something to separate from — not as a permanent border).
 */
export function useScrolled(ref, threshold = 4) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;

        const handleScroll = () => setScrolled(node.scrollTop > threshold);
        handleScroll();
        node.addEventListener('scroll', handleScroll, { passive: true });
        return () => node.removeEventListener('scroll', handleScroll);
    }, [ref, threshold]);

    return scrolled;
}
