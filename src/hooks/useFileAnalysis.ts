import { useState, useCallback } from 'react';
import { fileAnalysisService } from '@/services/FileAnalysisService';
import {
    FileUpload,
    CSVAnalysisResult,
    PDFAnalysisResult,
    CSVAnalysisCategory,
    PDFAnalysisCategory
} from '@/types';

export function useFileAnalysis(stationId: string, authUserId: string) {
    const [isUploading, setIsUploading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedFile, setUploadedFile] = useState<FileUpload | null>(null);
    const [csvResult, setCsvResult] = useState<CSVAnalysisResult | null>(null);
    const [pdfResult, setPdfResult] = useState<PDFAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setUploadedFile(null);
        setCsvResult(null);
        setPdfResult(null);
        setError(null);
        setUploadProgress(0);
    }, []);

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        setError(null);
        try {
            const result = await fileAnalysisService.uploadFile(
                file,
                stationId,
                authUserId,
                (progress) => setUploadProgress(progress)
            );
            setUploadedFile(result);
            return result;
        } catch (err: any) {
            setError(err.message || 'Upload failed');
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    const analyzeCSV = async (file: FileUpload, category: CSVAnalysisCategory) => {
        setIsAnalyzing(true);
        setError(null);
        try {
            const result = await fileAnalysisService.analyzeCSV(file, category);
            setCsvResult(result);
            return result;
        } catch (err: any) {
            setError(err.message || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const analyzePDF = async (file: FileUpload, category: PDFAnalysisCategory) => {
        setIsAnalyzing(true);
        setError(null);
        try {
            const result = await fileAnalysisService.analyzePDF(file, category);
            setPdfResult(result);
            return result;
        } catch (err: any) {
            setError(err.message || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return {
        uploadFile,
        analyzeCSV,
        analyzePDF,
        isUploading,
        isAnalyzing,
        uploadProgress,
        uploadedFile,
        csvResult,
        pdfResult,
        error,
        reset
    };
}
