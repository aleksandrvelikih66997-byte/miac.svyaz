'use server';
/**
 * @fileOverview This file defines a Genkit flow for an intelligent configuration assistant.
 * It allows administrators to describe desired Asterisk configurations in natural language,
 * and the AI generates the corresponding configuration snippets and explanations.
 *
 * - intelligentConfigurationAssistant - A function that handles the configuration generation process.
 * - IntelligentConfigurationAssistantInput - The input type for the intelligentConfigurationAssistant function.
 * - IntelligentConfigurationAssistantOutput - The return type for the intelligentConfigurationAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IntelligentConfigurationAssistantInputSchema = z.object({
  request: z.string().describe('Natural language description of the desired Asterisk configuration (e.g., "Создать группу для отдела продаж с очередью и переадресацией на мобильный после 30 секунд").'),
});
export type IntelligentConfigurationAssistantInput = z.infer<typeof IntelligentConfigurationAssistantInputSchema>;

const IntelligentConfigurationAssistantOutputSchema = z.object({
  configType: z.enum(['extension', 'queue', 'route', 'other']).describe('The type of Asterisk configuration generated.'),
  generatedConfig: z.string().describe('The generated Asterisk configuration snippet in plain text, ready to be pasted into configuration files (e.g., extensions.conf, queues.conf).'),
  explanation: z.string().describe('A human-readable explanation of the generated configuration and its purpose.'),
});
export type IntelligentConfigurationAssistantOutput = z.infer<typeof IntelligentConfigurationAssistantOutputSchema>;

export async function intelligentConfigurationAssistant(input: IntelligentConfigurationAssistantInput): Promise<IntelligentConfigurationAssistantOutput> {
  return intelligentConfigurationAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'intelligentConfigurationAssistantPrompt',
  input: {schema: IntelligentConfigurationAssistantInputSchema},
  output: {schema: IntelligentConfigurationAssistantOutputSchema},
  prompt: `You are an expert Asterisk PBX administrator and a configuration assistant. Your task is to interpret natural language requests for Asterisk configurations and generate the corresponding configuration snippets.

The user will provide a request in natural language describing what kind of Asterisk configuration they need. You must generate valid Asterisk configuration syntax (e.g., for extensions.conf, queues.conf, etc.) and provide a clear explanation.

The configuration should be structured and directly usable in Asterisk configuration files. If the request involves multiple configuration types (e.g., a queue and a routing rule), output the primary type in 'configType' and include all necessary snippets in 'generatedConfig'.

Example Request: "Создать группу для отдела продаж с очередью и переадресацией на мобильный после 30 секунд"

Example Output:
```json
{
  "configType": "queue",
  "generatedConfig": "[sales-queue]\nstrategy=ringall\nmember=SIP/101,SIP/102\ntimeout=30\n\n[from-internal]\nexten => _X.,1,Dial(SIP/${EXTEN})\nexten => _X.,n,GoToIf($[\"${DIALSTATUS}\" = \"NOANSWER\"]?mobile-forward,s,1)\n\n[mobile-forward]\nexten => s,1,Dial(SIP/mobile_gateway/79xxxxxxxxx,30,t)\nexten => s,n,Hangup()",
  "explanation": "Эта конфигурация создает очередь 'sales-queue' для отдела продаж с членами 101 и 102. Если звонок не отвечен в течение 30 секунд, он перенаправляется на мобильный номер 79xxxxxxxxx через мобильный шлюз."
}
```

Generate the Asterisk configuration and explanation for the following request:
Request: {{{request}}}`,
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
      throw new Error('Failed to generate configuration from prompt.');
    }
    return output;
  }
);
