import { Injectable } from '@nestjs/common';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { loadQAChain } from 'langchain/chains';
import { IngestService } from './ingest.service';

@Injectable()
export class AppService {
  private readonly directory = 'faiss_store';

  constructor(private readonly ingestService: IngestService) { }

  async processLinksAndAnswerQuestion(urls: string[], question: string) {
    try {
      // 1. Ingest data
      await this.ingestService.ingest(urls);

      // 2. Answer question
      return await this.answerQuestion(question);
    } catch (error) {
      console.error('Error during QA processing:', error);
      throw error;
    }
  }

  async answerQuestion(question: string) {
    try {
      const embeddings = new OpenAIEmbeddings();
      const vectorStore = await FaissStore.load(this.directory, embeddings);

      const llm = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1000,
      });

      const chain = loadQAChain(llm, { type: 'map_reduce' });

      // First, retrieve relevant documents
      const retriever = vectorStore.asRetriever();
      const retrievedDocs = await retriever.invoke(question);

      // Then, run the Map-Reduce chain with callbacks to log LLM calls
      const result = await chain.invoke(
        {
          input_documents: retrievedDocs,
          question: question,
        },
        {
          callbacks: [
            {
              handleChainStart: (chain) => {
                console.log(
                  `\n>>> Starting Chain: ${chain.name || 'QA Chain'}`,
                );
              },
              handleLLMStart: async (llm, prompts) => {
                console.log(
                  `\n--- [LangChain Callback] LLM Call Start (${prompts.length} prompts in batch) ---`,
                );
              },
              handleLLMEnd: async (output) => {
                console.log('--- [LangChain Callback] LLM Call End ---');
                // Log token usage if available (specific to OpenAI)
                if (output.llmOutput?.tokenUsage) {
                  const usage = output.llmOutput.tokenUsage;
                  console.log(
                    `-> Token Usage: Total=${usage.totalTokens} (Prompt=${usage.promptTokens}, Completion=${usage.completionTokens})`,
                  );
                }
                console.log(''); // Add a newline for readability
              },
              handleLLMError: async (err) => {
                console.error('--- [LangChain Callback] LLM Call Error ---');
                console.error('-> Error:', err.message);
              },
              handleChainEnd: (outputs) => {
                console.log(`<<< Finished Chain execution`);
              },
              handleChainError: (err) => {
                console.error(`!!! Chain Error:`, err.message);
              },
            },
          ],
        },
      );

      return {
        status: 'done',
        answer: result.text,
      };
    } catch (error) {
      console.error('Error during answer processing:', error);
      throw error;
    }
  }
}

