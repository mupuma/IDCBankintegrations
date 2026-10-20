import 'dotenv/config';
import { validateZanacoConfiguration } from './zwsClient';

validateZanacoConfiguration();
void import('./index').then(() => import('./worker'));
