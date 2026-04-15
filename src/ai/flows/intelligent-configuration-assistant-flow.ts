
'use server';
/**
 * @fileOverview This file defines a Genkit flow for an intelligent configuration assistant.
 * It allows administrators to describe desired Asterisk configurations in natural language,
 * and the AI generates the corresponding configuration snippets and explanations.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IntelligentConfigurationAssistantInputSchema = z.object({
  request: z.string().describe('Natural language description of the desired Asterisk configuration.'),
});
export type IntelligentConfigurationAssistantInput = z.infer<typeof IntelligentConfigurationAssistantInputSchema>;

const IntelligentConfigurationAssistantOutputSchema = z.object({
  configType: z.enum(['extension', 'queue', 'route', 'other']).describe('The type of Asterisk configuration generated.'),
  generatedConfig: z.string().describe('The generated Asterisk configuration snippet in plain text.'),
  explanation: z.string().describe('A human-readable explanation of the generated configuration.'),
});
export type IntelligentConfigurationAssistantOutput = z.infer<typeof IntelligentConfigurationAssistantOutputSchema>;

export async function intelligentConfigurationAssistant(input: IntelligentConfigurationAssistantInput): Promise<IntelligentConfigurationAssistantOutput> {
  return intelligentConfigurationAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'intelligentConfigurationAssistantPrompt',
  input: {schema: IntelligentConfigurationAssistantInputSchema},
  output: {schema: IntelligentConfigurationAssistantOutputSchema},
  prompt: `You are an expert Asterisk PBX administrator. Your task is to interpret natural language requests and generate configuration snippets.

Request: {{{request}}}

Your output must be a valid JSON object matching the requested schema. Ensure the 'generatedConfig' field contains a valid Asterisk config format (ini-like).`,
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
