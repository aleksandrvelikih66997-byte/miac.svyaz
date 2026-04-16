'use server';
/**
 * @fileOverview ИИ-помощник, настроенный под среду AltLinux SP и Asterisk 20.
 * Учитывает настройки manager.conf (пользователь miac) и PJSIP.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IntelligentConfigurationAssistantInputSchema = z.object({
  request: z.string().describe('Запрос на настройку Asterisk (например, "создать очередь для техподдержки").'),
});
export type IntelligentConfigurationAssistantInput = z.infer<typeof IntelligentConfigurationAssistantInputSchema>;

const IntelligentConfigurationAssistantOutputSchema = z.object({
  configType: z.enum(['extension', 'queue', 'route', 'pjsip', 'manager']).describe('Тип генерируемого конфига.'),
  generatedConfig: z.string().describe('Текст конфигурации в формате Asterisk (.conf).'),
  explanation: z.string().describe('Пояснение к настройкам.'),
  targetFile: z.string().describe('В какой файл рекомендуется добавить этот код (например, pjsip_miac_users.conf).'),
});
export type IntelligentConfigurationAssistantOutput = z.infer<typeof IntelligentConfigurationAssistantOutputSchema>;

export async function intelligentConfigurationAssistant(input: IntelligentConfigurationAssistantInput): Promise<IntelligentConfigurationAssistantOutput> {
  return intelligentConfigurationAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'intelligentConfigurationAssistantPrompt',
  input: {schema: IntelligentConfigurationAssistantInputSchema},
  output: {schema: IntelligentConfigurationAssistantOutputSchema},
  prompt: `Вы — эксперт по Asterisk 20 в среде AltLinux SP. 
Контекст сервера пользователя:
- Используется PJSIP.
- Контекст для внутренних вызовов: [from-internal].
- AMI пользователь: miac (secret: MiacAMI2026).
- Основной транспорт: [transport-udp].
- Конфиги абонентов подключаются через #include pjsip_miac_users.conf.

Запрос пользователя: {{{request}}}

Сгенерируйте оптимальный конфиг, соответствующий этой архитектуре. Если создается абонент, укажите, что его нужно добавить в pjsip_miac_users.conf.`,
});

const intelligentConfigurationAssistantFlow = ai.defineFlow(
  {
    name: 'intelligentConfigurationAssistantFlow',
    inputSchema: IntelligentConfigurationAssistantInputSchema,
    outputSchema: IntelligentConfigurationAssistantOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('Не удалось сгенерировать конфигурацию.');
    }
    return output;
  }
);
