import { usePage, usePageIndex, PageIndex } from '@builder.io/qwest';
import { component$, Host, useHostElement, useScopedStyles$ } from '@builder.io/qwik';
import styles from './content-nav.css?inline';

export const ContentNav = component$(
  async () => {
    useScopedStyles$(styles);

    const hostElm = useHostElement();

    const page = await usePage(hostElm);
    const pageIndex = usePageIndex(hostElm)!;

    let prevText: string | undefined;
    let prevHref: string | undefined;
    let nextText: string | undefined;
    let nextHref: string | undefined;

    if (page && pageIndex) {
      const pageOrder: PageIndex[] = [];

      const readIndex = (i: PageIndex) => {
        pageOrder.push(i);
        if (i.items) {
          for (const item of i.items) {
            readIndex(item);
          }
        }
      };
      readIndex(pageIndex);

      const current = pageOrder.findIndex((p) => p.href === page.url.pathname);
      if (current > -1) {
        let prev = pageOrder[current - 1];
        if (prev && prev.href) {
          prevText = prev.text;
          prevHref = prev.href;
        } else {
          prev = pageOrder[current - 2];
          if (prev && prev.href) {
            prevText = prev.text;
            prevHref = prev.href;
          }
        }

        const next = pageOrder[current + 1];
        if (next) {
          nextText = next.text;
          if (next.href) {
            nextHref = next.href;
          } else if (pageOrder[current + 2]?.href) {
            nextHref = pageOrder[current + 2].href;
          }
        }
      }
    }

    return (
      <Host class="content-nav border-t border-slate-300 flex flex-wrap py-4">
        <div class="flex-1">
          {prevText && prevHref ? (
            <a class="px-3 py-1 prev" href={prevHref}>
              {prevText}
            </a>
          ) : null}
        </div>
        <div class="flex-1 text-right">
          {nextText && nextHref ? (
            <a class="px-3 py-1 next" href={nextHref}>
              {nextText}
            </a>
          ) : null}
        </div>
      </Host>
    );
  },
  { tagName: 'nav' }
);
