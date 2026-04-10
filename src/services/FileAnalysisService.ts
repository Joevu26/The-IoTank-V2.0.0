/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/config/supabase';
import {
    FileUpload,
    CSVAnalysisResult,
    PDFAnalysisResult,
    CSVAnalysisCategory,
    PDFAnalysisCategory
} from '@/types';

class FileAnalysisService {
    /**
     * Uploads a file to Supabase Storage and creates a record in the database
     */
    async uploadFile(
        file: File,
        orgId: string,
        userId: string,
        onProgress?: (progress: number) => void
    ): Promise<FileUpload> {
        const fileId = crypto.randomUUID();
        const extension = file.name.split('.').pop();
        const storagePath = `uploads/${orgId}/${fileId}.${extension}`;

        // Supabase storage upload
        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('uploads')
            .getPublicUrl(storagePath);

        if (onProgress) onProgress(100);

        const fileRecord: FileUpload = {
            id: fileId,
            fileName: file.name,
            fileType: file.type.includes('pdf') ? 'pdf' : 'csv',
            fileSize: file.size,
            storageUrl: storagePath,
            publicUrl: publicUrl,
            uploadedBy: userId,
            uploadedAt: Date.now(),
            stationId: orgId,
            analysisStatus: 'pending'
        };

        const { error } = await supabase
            .from('file_uploads')
            .upsert({
                id: fileId,
                station_id: orgId,
                user_id: userId,
                file_name: file.name,
                file_type: file.type.includes('pdf') ? 'pdf' : 'csv',
                file_size: file.size,
                storage_path: storagePath,
                public_url: publicUrl,
                analysis_status: 'pending'
            });

        if (error) throw error;

        return fileRecord;
    }

    /**
     * Calls Gemini via Supabase Edge Functions to analyze a CSV file
     */
    async analyzeCSV(
        fileRecord: FileUpload,
        category: CSVAnalysisCategory
    ): Promise<CSVAnalysisResult> {
        if (!fileRecord.publicUrl) throw new Error('File URL is missing');

        const prompt = `
            Analyze this fuel-related CSV document. 
            The category is: ${category}.
            Provide a deep industrial analysis for a fuel management system.
            Return the result in JSON format matching this structure:
            {
                "summary": "Executive summary of the data",
                "insights": ["List of key insights"],
                "dataQuality": { "completeness": 0-100, "accuracy": 0-100, "issues": [] },
                "keyMetrics": { "metricName": value },
                "recommendations": ["Actionable steps"],
                "confidence": 0.0-1.0
            }
        `;

        try {
            // Calling Supabase Edge Function
            const { data, error: functionError } = await supabase.functions.invoke('gemini-proxy', {
                body: {
                    endpoint: 'models/gemini-1.5-flash:generateContent',
                    body: {
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    fileData: {
                                        mimeType: 'text/csv',
                                        fileUri: fileRecord.publicUrl
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.2,
                            responseMimeType: 'application/json'
                        }
                    }
                }
            });

            if (functionError) throw functionError;

            const aiResponse = JSON.parse(data.candidates[0].content.parts[0].text);

            const result: CSVAnalysisResult = {
                id: crypto.randomUUID(),
                fileId: fileRecord.id,
                analysisType: category,
                summary: aiResponse.summary,
                insights: aiResponse.insights,
                dataQuality: aiResponse.dataQuality,
                keyMetrics: aiResponse.keyMetrics,
                recommendations: aiResponse.recommendations,
                timestamp: Date.now(),
                confidence: aiResponse.confidence || 1.0
            };

            // Save history
            const { error: historyError } = await supabase
                .from('analysis_history')
                .insert({
                    file_id: fileRecord.id,
                    station_id: fileRecord.stationId,
                    analysis_type: category,
                    analysis_result: result
                });

            if (historyError) throw historyError;

            // Update file status
            const { error: statusError } = await supabase
                .from('file_uploads')
                .update({ analysis_status: 'completed' })
                .eq('id', fileRecord.id);

            if (statusError) throw statusError;

            return result;
        } catch (error: any) {
            console.error('File Analysis Error:', error);
            throw new Error(`AI Analysis Error: ${error.message}`);
        }
    }

    /**
     * Calls Gemini via Supabase Edge Functions to analyze a PDF file
     */
    async analyzePDF(
        fileRecord: FileUpload,
        category: PDFAnalysisCategory
    ): Promise<PDFAnalysisResult> {
        if (!fileRecord.publicUrl) throw new Error('File URL is missing');

        const prompt = `
            Analyze this industrial PDF document. 
            The document category is: ${category}.
            Extract all relevant technical and financial data.
            Return the result in JSON format matching this structure:
            {
                "documentType": "Specific type identified",
                "summary": "Concise summary of the document",
                "extractedData": { "field": "value" },
                "keyFindings": ["List of discoveries"],
                "actionItems": ["Steps to take"],
                "confidence": 0.0-1.0
            }
        `;

        try {
            const { data, error: functionError } = await supabase.functions.invoke('gemini-proxy', {
                body: {
                    endpoint: 'models/gemini-1.5-flash:generateContent',
                    body: {
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    fileData: {
                                        mimeType: 'application/pdf',
                                        fileUri: fileRecord.publicUrl
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            responseMimeType: 'application/json'
                        }
                    }
                }
            });

            if (functionError) throw functionError;

            const aiResponse = JSON.parse(data.candidates[0].content.parts[0].text);

            const result: PDFAnalysisResult = {
                id: crypto.randomUUID(),
                fileId: fileRecord.id,
                analysisType: category,
                documentType: aiResponse.documentType,
                summary: aiResponse.summary,
                extractedData: aiResponse.extractedData,
                keyFindings: aiResponse.keyFindings,
                actionItems: aiResponse.actionItems,
                timestamp: Date.now(),
                confidence: aiResponse.confidence || 1.0
            };

            // Save history
            const { error: historyError } = await supabase
                .from('analysis_history')
                .insert({
                    file_id: fileRecord.id,
                    station_id: fileRecord.stationId,
                    analysis_type: category,
                    analysis_result: result
                });

            if (historyError) throw historyError;

            // Update file status
            const { error: statusError } = await supabase
                .from('file_uploads')
                .update({ analysis_status: 'completed' })
                .eq('id', fileRecord.id);

            if (statusError) throw statusError;

            return result;
        } catch (error: any) {
            console.error('File Analysis Error:', error);
            throw new Error(`AI Analysis Error: ${error.message}`);
        }
    }
}

export const fileAnalysisService = new FileAnalysisService();
