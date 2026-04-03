'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { Upload, FileSpreadsheet } from 'lucide-react'
import { useCreateGuest } from '@/lib/hooks/use-guests'
import { useCreateUnit } from '@/lib/hooks/use-units'

interface DataImportProps {
  type: 'guests' | 'units'
}

export function DataImport({ type }: DataImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const createGuest = useCreateGuest()
  const createUnit = useCreateUnit()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: 'خطأ',
          description: 'يرجى اختيار ملف CSV',
          variant: 'destructive',
        })
        return
      }
      setFile(selectedFile)
    }
  }

  async function handleImport() {
    if (!file) return

    setImporting(true)
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim())

        let successCount = 0
        let errorCount = 0

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          const data: any = {}

          headers.forEach((header, index) => {
            data[header] = values[index] || ''
          })

          try {
            if (type === 'guests') {
              await createGuest.mutateAsync({
                first_name: data['first_name'] || data['الاسم الأول'],
                last_name: data['last_name'] || data['اسم العائلة'],
                first_name_ar: data['first_name_ar'] || data['الاسم الأول (عربي)'],
                last_name_ar: data['last_name_ar'] || data['اسم العائلة (عربي)'],
                phone: data['phone'] || data['الهاتف'],
                email: data['email'] || data['البريد الإلكتروني'],
                military_rank: data['military_rank'] || data['الرتبة'],
                military_rank_ar: data['military_rank_ar'] || data['الرتبة (عربي)'],
                guest_type: (data['guest_type'] || data['نوع الضيف'] || 'military') as any,
              })
            } else if (type === 'units') {
              await createUnit.mutateAsync({
                location_id: data['location_id'] || data['معرف الموقع'],
                unit_number: data['unit_number'] || data['رقم الوحدة'],
                name: data['name'] || data['الاسم'],
                name_ar: data['name_ar'] || data['الاسم (عربي)'],
                type: (data['type'] || data['النوع']) as any,
                capacity: parseInt(data['capacity'] || data['السعة'] || '2'),
                beds: parseInt(data['beds'] || data['عدد الأسرة'] || '1'),
                bathrooms: parseInt(data['bathrooms'] || data['عدد الحمامات'] || '1'),
                status: (data['status'] || data['الحالة'] || 'available') as any,
              })
            }
            successCount++
          } catch (error) {
            console.error(`Error importing row ${i + 1}:`, error)
            errorCount++
          }
        }

        toast({
          title: 'اكتمل الاستيراد',
          description: `نجح: ${successCount}، فشل: ${errorCount}`,
        })

        setFile(null)
      } catch (error: any) {
        toast({
          title: 'خطأ',
          description: error.message || 'فشل في استيراد البيانات',
          variant: 'destructive',
        })
      } finally {
        setImporting(false)
      }
    }

    reader.readAsText(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          استيراد {type === 'guests' ? 'الضيوف' : 'الوحدات'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="import-file">اختر ملف CSV</Label>
          <div className="flex gap-2">
            <Input
              id="import-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="flex-1"
            />
            {file && (
              <Button
                onClick={handleImport}
                disabled={importing}
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? 'جاري الاستيراد...' : 'استيراد'}
              </Button>
            )}
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              الملف المحدد: {file.name}
            </p>
          )}
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>تنسيق CSV المطلوب:</p>
          {type === 'guests' ? (
            <ul className="list-disc list-inside space-y-1 mr-4">
              <li>first_name, last_name, phone, email (مطلوب)</li>
              <li>first_name_ar, last_name_ar, military_rank (اختياري)</li>
            </ul>
          ) : (
            <ul className="list-disc list-inside space-y-1 mr-4">
              <li>location_id, unit_number, type, capacity (مطلوب)</li>
              <li>name, name_ar, beds, bathrooms (اختياري)</li>
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

