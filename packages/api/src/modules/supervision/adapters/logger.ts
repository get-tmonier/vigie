import { Logger } from 'effect';

export const SupervisionLoggerLive = Logger.layer([Logger.consolePretty()]);
