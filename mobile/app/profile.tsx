import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme/colors';
import { HapticTouchable } from '../src/components/HapticTouchable';
import { Badge } from '../src/components/Badge';
import {
  loadLocalProfile,
  saveLocalProfile,
  loadLocalCards,
  addLocalCard,
  deleteLocalCard,
  setDefaultLocalCard,
  loadLocalTransactions,
  recordLocalTransaction,
  getLocalFundedBalance,
  exportAllLocalData,
  wipeAllLocalData,
  UserProfile,
  PaymentCard,
  PaymentTransaction,
  DEFAULT_PROFILE,
} from '../src/storage/localStorage';
import { useApp } from '../src/context/AppContext';
import { haptic } from '../src/utils/haptics';

export default function ProfileScreen() {
  const { refreshDashboard } = useApp();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [fundedBalance, setFundedBalance] = useState(10000);

  // Edit Profile Modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [bioInput, setBioInput] = useState('');

  // Add Card Modal
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');

  // Deposit & Withdraw Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payType, setPayType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [payAmount, setPayAmount] = useState('500');

  const loadData = async () => {
    const p = await loadLocalProfile();
    const c = await loadLocalCards();
    const tx = await loadLocalTransactions();
    const b = await getLocalFundedBalance();

    setProfile(p);
    setCards(c);
    setTransactions(tx);
    setFundedBalance(b);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save profile changes
  const handleSaveProfile = async () => {
    const updated: UserProfile = {
      ...profile,
      name: nameInput.trim() || profile.name,
      email: emailInput.trim() || profile.email,
      bio: bioInput.trim() || profile.bio,
    };
    await saveLocalProfile(updated);
    setProfile(updated);
    setShowEditProfile(false);
    haptic.success();
    Alert.alert('Profile Saved', 'Your profile details are stored locally on your device.');
  };

  // Add card
  const handleAddCard = async () => {
    const cleanNum = cardNumber.replace(/\s+/g, '');
    if (cleanNum.length < 15) {
      Alert.alert('Invalid Card', 'Please enter a valid 15 or 16-digit card number.');
      return;
    }
    if (!cardHolder.trim()) {
      Alert.alert('Missing Name', 'Please enter the cardholder name.');
      return;
    }

    let brand: PaymentCard['brand'] = 'Card';
    if (cleanNum.startsWith('4')) brand = 'Visa';
    else if (cleanNum.startsWith('5')) brand = 'Mastercard';
    else if (cleanNum.startsWith('34') || cleanNum.startsWith('37')) brand = 'Amex';

    const last4 = cleanNum.slice(-4);

    const updated = await addLocalCard({
      brand,
      last4,
      cardholder: cardHolder.trim().toUpperCase(),
      expMonth: expMonth.trim() || '12',
      expYear: expYear.trim() || '29',
      isDefault: cards.length === 0,
    });

    setCards(updated);
    setShowAddCard(false);
    setCardNumber('');
    setCardHolder('');
    setExpMonth('');
    setExpYear('');
    haptic.success();
    Alert.alert('Card Added', `Your ${brand} ending in ${last4} is encrypted and saved locally on this device.`);
  };

  const handleDeleteCard = (card: PaymentCard) => {
    Alert.alert(
      'Remove Card?',
      `Delete ${card.brand} ending in ${card.last4} from local device storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteLocalCard(card.id);
            setCards(updated);
            haptic.medium();
          },
        },
      ]
    );
  };

  // Deposit or Withdraw
  const handleProcessPayment = async () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    if (cards.length === 0) {
      Alert.alert('No Card Linked', 'Please add a payment card first before depositing or receiving payouts.');
      return;
    }

    const defaultCard = cards.find((c) => c.isDefault) || cards[0];

    if (payType === 'withdrawal' && amount > fundedBalance) {
      Alert.alert('Insufficient Balance', 'Withdrawal amount exceeds your current local vault balance.');
      return;
    }

    haptic.medium();
    const updatedTx = await recordLocalTransaction(
      payType,
      amount,
      defaultCard.last4,
      payType === 'deposit'
        ? `Instant Card Top-Up via ${defaultCard.brand} •••• ${defaultCard.last4}`
        : `Profit Payout to ${defaultCard.brand} •••• ${defaultCard.last4}`
    );

    const newBal = await getLocalFundedBalance();
    setFundedBalance(newBal);
    setTransactions(updatedTx);
    setShowPayModal(false);
    haptic.success();
    refreshDashboard();

    Alert.alert(
      payType === 'deposit' ? 'Deposit Completed' : 'Payout Initiated',
      payType === 'deposit'
        ? `Successfully credited $${amount.toLocaleString()} to your local trading vault from your card.`
        : `Successfully queued a payout of $${amount.toLocaleString()} to your card ending in ${defaultCard.last4}.`
    );
  };

  // Export Data
  const handleExportData = async () => {
    haptic.selection();
    const jsonString = await exportAllLocalData();
    try {
      await Share.share({
        message: jsonString,
        title: 'Aurum Local Device Backup',
      });
    } catch {}
  };

  // Wipe Data
  const handleWipeData = () => {
    Alert.alert(
      'WIPE ALL LOCAL DATA?',
      'This will permanently delete your local profile, saved cards, and transaction records from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Wipe',
          style: 'destructive',
          onPress: async () => {
            await wipeAllLocalData();
            haptic.heavy();
            loadData();
            Alert.alert('Data Wiped', 'All local records removed.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={[styles.avatarCircle, { backgroundColor: profile.avatarColor }]}>
              <Text style={styles.avatarInitials}>
                {profile.name.substring(0, 2).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <HapticTouchable
                  style={styles.editBtn}
                  onPress={() => {
                    setNameInput(profile.name);
                    setEmailInput(profile.email);
                    setBioInput(profile.bio);
                    setShowEditProfile(true);
                  }}
                  hapticType="selection"
                >
                  <Ionicons name="pencil" size={14} color={colors.gold} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </HapticTouchable>
              </View>
              <Text style={styles.profileEmail}>{profile.email}</Text>
            </View>
          </View>

          <View style={styles.sovereignBadgeRow}>
            <Ionicons name="shield-checkmark" size={16} color={colors.bullish} />
            <Text style={styles.sovereignBadgeText}>{profile.tier}</Text>
          </View>

          <Text style={styles.profileBio}>{profile.bio}</Text>

          <View style={styles.localNotice}>
            <Ionicons name="hardware-chip-outline" size={16} color={colors.gold} />
            <Text style={styles.localNoticeText}>
              100% Free & Local: All accounts, cards, API keys, and transaction history are stored directly on your device. Zero subscriptions, zero third-party tracking.
            </Text>
          </View>
        </View>

        {/* Local Vault Balance & Fast Actions */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>LOCAL VAULT BALANCE</Text>
          <Text style={styles.balanceValue}>
            ${fundedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>

          <View style={styles.actionButtonsRow}>
            <HapticTouchable
              style={[styles.payActionBtn, { backgroundColor: colors.bullish }]}
              hapticType="medium"
              onPress={() => {
                setPayType('deposit');
                setPayAmount('500');
                setShowPayModal(true);
              }}
            >
              <Ionicons name="arrow-down-circle" size={18} color="#000" />
              <Text style={styles.payActionBtnText}>Deposit with Card</Text>
            </HapticTouchable>

            <HapticTouchable
              style={[styles.payActionBtn, { backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderLight }]}
              hapticType="medium"
              onPress={() => {
                setPayType('withdrawal');
                setPayAmount('250');
                setShowPayModal(true);
              }}
            >
              <Ionicons name="arrow-up-circle" size={18} color={colors.gold} />
              <Text style={[styles.payActionBtnText, { color: colors.textPrimary }]}>Receive / Payout</Text>
            </HapticTouchable>
          </View>
        </View>

        {/* Saved Payment Cards Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="card" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>MY PAYMENT CARDS ({cards.length})</Text>
            </View>
            <HapticTouchable
              style={styles.addCardBtn}
              onPress={() => setShowAddCard(true)}
              hapticType="selection"
            >
              <Ionicons name="add" size={16} color="#000" />
              <Text style={styles.addCardBtnText}>Add Card</Text>
            </HapticTouchable>
          </View>

          {cards.length === 0 ? (
            <View style={styles.emptyCardBox}>
              <Ionicons name="card-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyCardText}>No payment cards linked yet.</Text>
              <Text style={styles.emptyCardSub}>
                Add your debit or credit card to deposit trading funds and receive instant payouts directly on your device.
              </Text>
            </View>
          ) : (
            cards.map((c) => (
              <View key={c.id} style={styles.cardItem}>
                <View style={styles.cardItemTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons
                      name="card"
                      size={20}
                      color={c.brand === 'Visa' ? '#1A1F71' : c.brand === 'Mastercard' ? '#EB001B' : colors.gold}
                    />
                    <Text style={styles.cardBrand}>{c.brand}</Text>
                    {c.isDefault && <Badge label="PRIMARY" variant="gold" />}
                  </View>

                  <HapticTouchable
                    style={styles.deleteCardBtn}
                    onPress={() => handleDeleteCard(c)}
                    hapticType="medium"
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.bearish} />
                  </HapticTouchable>
                </View>

                <Text style={styles.cardNumberMasked}>
                  •••• •••• •••• <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>{c.last4}</Text>
                </Text>

                <View style={styles.cardItemBottom}>
                  <Text style={styles.cardHolderName}>{c.cardholder}</Text>
                  <Text style={styles.cardExpiry}>
                    EXP {c.expMonth}/{c.expYear}
                  </Text>
                </View>

                {!c.isDefault && (
                  <HapticTouchable
                    style={styles.setPrimaryBtn}
                    onPress={async () => {
                      const updated = await setDefaultLocalCard(c.id);
                      setCards(updated);
                      haptic.selection();
                    }}
                  >
                    <Text style={styles.setPrimaryText}>Set as Primary Card</Text>
                  </HapticTouchable>
                )}
              </View>
            ))
          )}
        </View>

        {/* Local Transaction Ledger */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="receipt-outline" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>DEVICE PAYMENT LEDGER</Text>
            </View>
            <Badge label="LOCAL" variant="neutral" />
          </View>

          {transactions.length === 0 ? (
            <Text style={styles.emptyLedgerText}>No payment transactions recorded on this device yet.</Text>
          ) : (
            transactions.slice(0, 8).map((tx) => {
              const isDeposit = tx.type === 'deposit';
              return (
                <View key={tx.id} style={styles.txRow}>
                  <View style={styles.txIconBox}>
                    <Ionicons
                      name={isDeposit ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={isDeposit ? colors.bullish : colors.gold}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>{isDeposit ? 'Card Deposit' : 'Card Payout'}</Text>
                    <Text style={styles.txSub}>
                      {new Date(tx.timestamp).toLocaleDateString()} · •••• {tx.cardLast4}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.txAmount,
                      { color: isDeposit ? colors.bullish : colors.textPrimary },
                    ]}
                  >
                    {isDeposit ? '+' : '-'}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Data Sovereignty & Backup Controls */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>DATA SOVEREIGNTY & PRIVACY</Text>
          <Text style={styles.privacySub}>
            You own 100% of your financial data. You can export a full offline JSON backup or wipe local storage at any time.
          </Text>

          <View style={styles.privacyActionsRow}>
            <HapticTouchable
              style={styles.backupBtn}
              onPress={handleExportData}
              hapticType="medium"
            >
              <Ionicons name="cloud-download-outline" size={16} color={colors.gold} />
              <Text style={styles.backupBtnText}>Export Device Backup (JSON)</Text>
            </HapticTouchable>

            <HapticTouchable
              style={styles.wipeBtn}
              onPress={handleWipeData}
              hapticType="heavy"
            >
              <Ionicons name="trash-bin-outline" size={16} color={colors.bearish} />
              <Text style={styles.wipeBtnText}>Wipe Local Data</Text>
            </HapticTouchable>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Local Profile</Text>
            <HapticTouchable style={styles.closeBtn} onPress={() => setShowEditProfile(false)}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </HapticTouchable>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>DISPLAY NAME</Text>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g. Satoshi Sovereign"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="e.g. trader@local.device"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>TRADING PHILOSOPHY / BIO</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={bioInput}
              onChangeText={setBioInput}
              placeholder="Your trading guidelines..."
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <HapticTouchable
              style={styles.saveModalBtn}
              onPress={handleSaveProfile}
              hapticType="medium"
            >
              <Text style={styles.saveModalBtnText}>Save Profile to Device</Text>
            </HapticTouchable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add Card Modal */}
      <Modal
        visible={showAddCard}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddCard(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Payment Card</Text>
            <HapticTouchable style={styles.closeBtn} onPress={() => setShowAddCard(false)}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </HapticTouchable>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.secureCardBanner}>
              <Ionicons name="lock-closed" size={16} color={colors.gold} />
              <Text style={styles.secureCardText}>
                Encrypted locally on device. Zero data sent to external servers.
              </Text>
            </View>

            <Text style={styles.inputLabel}>CARD NUMBER (15-16 DIGITS)</Text>
            <TextInput
              style={styles.input}
              value={cardNumber}
              onChangeText={setCardNumber}
              placeholder="4242 4242 4242 4242"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              maxLength={19}
            />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>CARDHOLDER NAME</Text>
            <TextInput
              style={styles.input}
              value={cardHolder}
              onChangeText={setCardHolder}
              placeholder="FIRSTNAME LASTNAME"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>EXP MONTH (MM)</Text>
                <TextInput
                  style={styles.input}
                  value={expMonth}
                  onChangeText={setExpMonth}
                  placeholder="12"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>EXP YEAR (YY)</Text>
                <TextInput
                  style={styles.input}
                  value={expYear}
                  onChangeText={setExpYear}
                  placeholder="29"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>

            <HapticTouchable
              style={styles.saveModalBtn}
              onPress={handleAddCard}
              hapticType="medium"
            >
              <Text style={styles.saveModalBtnText}>Save Card Encrypted</Text>
            </HapticTouchable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Process Deposit / Payout Modal */}
      <Modal
        visible={showPayModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPayModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {payType === 'deposit' ? 'Deposit with Card' : 'Receive Profit Payout'}
            </Text>
            <HapticTouchable style={styles.closeBtn} onPress={() => setShowPayModal(false)}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </HapticTouchable>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>ENTER AMOUNT (USD)</Text>
            <TextInput
              style={[styles.input, { fontSize: 24, fontWeight: '800', textAlign: 'center' }]}
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="numeric"
            />

            {/* Quick Amount Pills */}
            <View style={styles.quickPillsRow}>
              {['100', '250', '500', '1000', '5000'].map((amt) => (
                <HapticTouchable
                  key={amt}
                  style={[styles.quickPill, payAmount === amt && styles.quickPillActive]}
                  onPress={() => setPayAmount(amt)}
                  hapticType="selection"
                >
                  <Text style={[styles.quickPillText, payAmount === amt && styles.quickPillTextActive]}>
                    ${amt}
                  </Text>
                </HapticTouchable>
              ))}
            </View>

            {cards.length > 0 && (
              <View style={styles.selectedCardBox}>
                <Ionicons name="card" size={18} color={colors.gold} />
                <Text style={styles.selectedCardText}>
                  Linked Card: {cards.find((c) => c.isDefault)?.brand || cards[0].brand} ••••{' '}
                  {cards.find((c) => c.isDefault)?.last4 || cards[0].last4}
                </Text>
              </View>
            )}

            <HapticTouchable
              style={[
                styles.saveModalBtn,
                { backgroundColor: payType === 'deposit' ? colors.bullish : colors.gold },
              ]}
              onPress={handleProcessPayment}
              hapticType="heavy"
            >
              <Text style={[styles.saveModalBtnText, { color: '#000' }]}>
                {payType === 'deposit' ? `Confirm Deposit of $${payAmount}` : `Confirm Payout of $${payAmount}`}
              </Text>
            </HapticTouchable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  profileEmail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
  },
  sovereignBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  sovereignBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.bullish,
    letterSpacing: 0.5,
  },
  profileBio: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  localNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(244, 196, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 196, 48, 0.2)',
    padding: 10,
    borderRadius: 8,
  },
  localNoticeText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  balanceCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 14,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  payActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  payActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },
  sectionCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addCardBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
  emptyCardBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyCardText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyCardSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  cardItem: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  cardItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardBrand: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  deleteCardBtn: {
    padding: 4,
  },
  cardNumberMasked: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: 10,
  },
  cardItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHolderName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  cardExpiry: {
    fontSize: 11,
    color: colors.textMuted,
  },
  setPrimaryBtn: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setPrimaryText: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: '700',
  },
  emptyLedgerText: {
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: 12,
    textAlign: 'center',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  txIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  txSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  privacySub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginVertical: 8,
  },
  privacyActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backupBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
  },
  wipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 59, 86, 0.1)',
    borderWidth: 1,
    borderColor: colors.bearish,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  wipeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.bearish,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
  },
  modalContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveModalBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveModalBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
  },
  secureCardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244, 196, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 196, 48, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  secureCardText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
  },
  quickPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 16,
  },
  quickPill: {
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickPillActive: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.gold,
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  quickPillTextActive: {
    color: colors.gold,
  },
  selectedCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgCard,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedCardText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
