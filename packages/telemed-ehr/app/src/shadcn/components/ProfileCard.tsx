import React from 'react'

const ProfileCard = () => {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <div className="flex flex-col space-y-4">
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold tracking-tight">John Smith</h3>
          <div className="text-sm text-muted-foreground">
            DOB: 01/15/1980 (43 years)
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Last Visit</div>
              <div className="text-sm">March 15, 2024</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Paperwork Updated</div>
              <div className="text-sm">March 1, 2024</div>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Phone</div>
              <div className="text-sm">(555) 123-4567</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Email</div>
              <div className="text-sm">john.smith@email.com</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileCard