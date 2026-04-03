'use client'

import { emailTemplates, renderEmailTemplate, renderEmailSubject } from '@/lib/email/templates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Mail, Eye } from 'lucide-react'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function EmailTemplatesPage() {
  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Mail className="h-8 w-8" />
            قوالب البريد الإلكتروني
          </h1>
          <p className="text-muted-foreground">إدارة قوالب الإشعارات والبريد الإلكتروني</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {emailTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{template.id}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4 line-clamp-2">{template.subject}</p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Eye className="mr-2 h-4 w-4" />
                      معاينة
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{template.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">الموضوع:</p>
                        <p className="text-sm bg-muted p-2 rounded">
                          {renderEmailSubject(template, {
                            reservation_number: 'RES-20240101-000001',
                            guest_name: 'أحمد علي',
                            unit_number: '101',
                            check_in_date: '2024-01-15',
                            check_out_date: '2024-01-20',
                            total_amount: '1000',
                            check_in_time: '14:00',
                            check_out_time: '12:00',
                            remaining_amount: '500',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">المحتوى:</p>
                        <div
                          className="border rounded p-4 bg-muted"
                          dangerouslySetInnerHTML={{
                            __html: renderEmailTemplate(template, {
                              reservation_number: 'RES-20240101-000001',
                              guest_name: 'أحمد علي',
                              unit_number: '101',
                              check_in_date: '2024-01-15',
                              check_out_date: '2024-01-20',
                              total_amount: '1000',
                              check_in_time: '14:00',
                              check_out_time: '12:00',
                              remaining_amount: '500',
                            }),
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">المتغيرات المستخدمة:</p>
                        <div className="flex flex-wrap gap-2">
                          {template.variables.map((variable) => (
                            <span
                              key={variable}
                              className="px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                            >
                              {`{{${variable}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </RoleGuard>
  )
}

