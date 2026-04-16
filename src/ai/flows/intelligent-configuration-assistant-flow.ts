'use server';
/**
 * @fileOverview ИИ-помощник, адаптированный под конкретную среду МИАЦ.
 * Учитывает настройки manager.conf и PJSIP транспорт.
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
  prompt: `Вы — ведущий эксперт по Asterisk 20 в среде AltLinux SP 10.
Ваш контекст:
- Пользователь AMI: miac
- Секрет AMI: MiacAMI2026
- Транспорт PJSIP: [transport-udp] (bind 0.0.0.0:5060)
- Контекст для внутренних номеров: [from-internal]
- Структура: файлы абонентов должны попадать в pjsip_miac_users.conf

Запрос пользователя: {{{request}}}

Сгенерируйте код конфигурации, который будет безопасным и соответствовать архитектуре МИАЦ. Используйте только PJSIP. Всегда указывайте auth_type=userpass для эндпоинтов.`,
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
