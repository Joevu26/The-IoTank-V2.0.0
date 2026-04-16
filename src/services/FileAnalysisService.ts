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
    private async getSafeAuthHeaders(): Promise<Record<string, string>> {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const headers: Record<string, string> = { 
            'Content-Type': 'application/json',
            'apikey': anonKey || ''
        };

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const isValidToken = session && (session.expires_at ? session.expires_at > (Date.now() / 1000) + 10 : true);
            
            if (isValidToken && session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
        } catch (e) {
            console.warn('[FileAnalysisService] Auth check failed, proceeding with limited headers.');
        }

        return headers;
    }

    /**
     * Uploads a file to Supabase Storage and creates a record in the database
     */
    async uploadFile(
        file: File,
        stationId: string,
        authUserId: string,
        onProgress?: (progress: number) => void
    ): Promise<FileUpload> {
        const fileId = crypto.randomUUID();
        const extension = file.name.split('.').pop();
        const storagePath = `uploads/${stationId}/${fileId}.${extension}`;

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
            uploadedBy: authUserId,
            uploadedAt: Date.now(),
            stationId: stationId,
            analysisStatus: 'pending'
        };

        const { error } = await supabase
            .from('file_uploads')
            .upsert({
                id: fileId,
                station_id: stationId,
                supabase_uid: authUserId,
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
            const headers = await this.getSafeAuthHeaders();
            const response = await fetch('https://suifvborodwergtrbjez.supabase.co/functions/v1/gemini-proxy', {
                method: 'POST',
                headers,
                body: JSON.stringify({
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
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(`AI Analysis Error: ${response.statusText}${errorBody.error ? ` - ${errorBody.error}` : ''}`);
            }

            const data = await response.json();
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
            const headers = await this.getSafeAuthHeaders();
            const response = await fetch('https://suifvborodwergtrbjez.supabase.co/functions/v1/gemini-proxy', {
                method: 'POST',
                headers,
                body: JSON.stringify({
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
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(`AI Analysis Error: ${response.statusText}${errorBody.error ? ` - ${errorBody.error}` : ''}`);
            }

            const data = await response.json();
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
