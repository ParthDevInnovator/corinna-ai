'use client'
import { useToast } from '@/components/ui/use-toast'
import { UserRegistrationProps, UserRegistrationSchema } from '@/schemas/auth.schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSignUp } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { 
  useForm, 
  SubmitHandler, 
  UseFormReturn 
} from 'react-hook-form'
import { onCompleteUserRegistration } from '@/actions/auth'

type SignUpFormHookReturn = {
  methods: UseFormReturn<UserRegistrationProps>
  onHandleSubmit: SubmitHandler<UserRegistrationProps>
  onGenerateOTP: (
    email: string, 
    password: string, 
    onNext: React.Dispatch<React.SetStateAction<number>>
  ) => Promise<void>
  loading: boolean
}

export const useSignUpForm = (): SignUpFormHookReturn => {
  const { toast } = useToast()
  const [loading, setLoading] = useState<boolean>(false)
  const { signUp, isLoaded, setActive } = useSignUp()
  const router = useRouter()

  const methods = useForm<UserRegistrationProps>({
    resolver: zodResolver(UserRegistrationSchema),
    defaultValues: {
      type: 'owner',
    },
    mode: 'onChange',
  })

  const onGenerateOTP = async (
    email: string, 
    password: string, 
    onNext: React.Dispatch<React.SetStateAction<number>>
  ): Promise<void> => {
    if (!isLoaded) {
      toast({
        title: 'Error',
        description: 'Authentication service not loaded',
      })
      return
    }

    try {
      const signUpAttempt = await signUp.create({
        emailAddress: email,
        password: password,
      })

      await signUpAttempt.prepareEmailAddressVerification({ 
        strategy: 'email_code' 
      })

      onNext((prev) => prev + 1)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred'

      toast({
        title: 'OTP Generation Error',
        description: errorMessage,
      })
    }
  }
  const onHandleSubmit: SubmitHandler<UserRegistrationProps> = async (values) => {
    if (!isLoaded) {
      toast({
        title: 'Error',
        description: 'Authentication service not loaded',
      })
      return
      }

      try {
        setLoading(true)
        const completeSignUp = await signUp.attemptEmailAddressVerification({
          code: values.otp,
        })

        if (completeSignUp.status !== 'complete') {
          throw new Error('Sign-up verification failed')
        }

        if (!signUp.createdUserId) {
          throw new Error('User ID not generated')
        }

        const registered = await onCompleteUserRegistration(
          values.fullname,
          signUp.createdUserId,
          values.type
        )

        if (registered?.status === 200 && registered.user) {
          await setActive({
            session: completeSignUp.createdSessionId,
          })
          router.push('/dashboard')
        } else {
          throw new Error('User registration failed')
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'An unexpected error occurred'

        toast({
          title: 'Registration Error',
          description: errorMessage,
        })
      } finally {
        setLoading(false)
      }
    }
  

  return {
    methods,
    onHandleSubmit,
    onGenerateOTP,
    loading,
  }
}