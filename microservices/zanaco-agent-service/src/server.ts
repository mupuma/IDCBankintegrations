import 'dotenv/config';
require('../../../shared/http-logging').installHttpLogging('zanaco-agent');
import { validateZanacoConfiguration } from './zwsClient';

validateZanacoConfiguration();
void import('./index').then(() => import('./worker'));
