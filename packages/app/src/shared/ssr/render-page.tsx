import { Effect } from 'effect';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Document } from './document';

export const renderPage = (page: ReactElement, opts: { title: string }) =>
  Effect.sync(() => {
    const html = `<!DOCTYPE html>${renderToString(<Document title={opts.title}>{page}</Document>)}`;
    return HttpServerResponse.html(html);
  });
